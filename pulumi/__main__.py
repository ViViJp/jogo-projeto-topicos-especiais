import hashlib
import json
import mimetypes
import subprocess
from pathlib import Path

import pulumi
import pulumi_aws as aws

stack = pulumi.get_stack()
if stack not in ("dev", "prod"):
    raise Exception("A stack precisa se chamar dev ou prod.")

config = pulumi.Config()
publish_domain = config.get_bool("publishDomain") or False

prefix = f"flesh-to-chrome-{stack}"
root = Path(__file__).parent
services_dir = root / "services"
domain = "nihil-legere-possum.lat"
is_prod = stack == "prod"

zone = None
if is_prod:
    zone = aws.route53.Zone("nihil-legere-possum", name=domain)
    pulumi.export("nameservers", zone.name_servers)
    pulumi.export("domain", domain)


def table(name, with_ttl=False):
    kwargs = {}
    if with_ttl:
        kwargs["ttl"] = aws.dynamodb.TableTtlArgs(attribute_name="ttl", enabled=True)
    return aws.dynamodb.Table(
        name,
        name=f"{prefix}-{name}",
        attributes=[
            aws.dynamodb.TableAttributeArgs(name="pk", type="S"),
            aws.dynamodb.TableAttributeArgs(name="sk", type="S"),
        ],
        hash_key="pk",
        range_key="sk",
        billing_mode="PAY_PER_REQUEST",
        **kwargs,
    )


def publish(service, table_resource, variables=None, invoke_function=None):
    path = services_dir / service
    subprocess.run(["npm", "install", "--omit=dev"], cwd=path, check=True)

    role = aws.iam.Role(
        f"{service}-role",
        assume_role_policy=json.dumps(
            {
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Effect": "Allow",
                        "Principal": {"Service": "lambda.amazonaws.com"},
                        "Action": "sts:AssumeRole",
                    }
                ],
            }
        ),
    )
    aws.iam.RolePolicyAttachment(
        f"{service}-logs",
        role=role.name,
        policy_arn="arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
    )
    aws.iam.RolePolicy(
        f"{service}-dynamodb",
        role=role.id,
        policy=table_resource.arn.apply(
            lambda arn: json.dumps(
                {
                    "Version": "2012-10-17",
                    "Statement": [
                        {
                            "Effect": "Allow",
                            "Action": [
                                "dynamodb:GetItem",
                                "dynamodb:PutItem",
                                "dynamodb:UpdateItem",
                                "dynamodb:DeleteItem",
                                "dynamodb:Query",
                                "dynamodb:TransactWriteItems",
                                "dynamodb:ConditionCheckItem",
                            ],
                            "Resource": [arn, f"{arn}/index/*"],
                        }
                    ],
                }
            )
        ),
    )
    if service == "comunicacoes":
        aws.iam.RolePolicy(
            f"{service}-ses",
            role=role.id,
            policy=json.dumps(
                {
                    "Version": "2012-10-17",
                    "Statement": [
                        {
                            "Effect": "Allow",
                            "Action": ["ses:SendEmail", "ses:SendRawEmail"],
                            "Resource": "*",
                        }
                    ],
                }
            ),
        )
    if invoke_function is not None:
        aws.iam.RolePolicy(
            f"{service}-invoke-service",
            role=role.id,
            policy=invoke_function.arn.apply(
                lambda arn: json.dumps(
                    {
                        "Version": "2012-10-17",
                        "Statement": [
                            {
                                "Effect": "Allow",
                                "Action": "lambda:InvokeFunction",
                                "Resource": arn,
                            }
                        ],
                    }
                )
            ),
        )
    environment = {"TABLE_NAME": table_resource.name, **(variables or {})}
    fn = aws.lambda_.Function(
        service,
        name=f"{prefix}-{service}",
        runtime=aws.lambda_.Runtime.NODE_JS22D_X,
        handler="index.handler",
        role=role.arn,
        code=pulumi.FileArchive(str(path)),
        timeout=10,
        environment=aws.lambda_.FunctionEnvironmentArgs(variables=environment),
    )
    pulumi.export(f"{service}_function", fn.name)
    pulumi.export(f"{service}_table", table_resource.name)
    return fn


ROUTES = {
    "conta": [
        "GET /auth/google/start",
        "GET /auth/google/callback",
        "GET /me",
        "POST /auth/logout",
    ],
    "campanha": [
        "GET /me/campaign",
        "PUT /me/campaign",
        "POST /me/campaign/reset",
        "POST /me/campaign/restore-gate",
    ],
    "partidas": [
        "POST /matches",
        "POST /matches/join",
        "GET /me/matches",
        "GET /matches/{id}",
        "POST /matches/{id}/ready",
        "POST /matches/{id}/leave",
    ],
    "comunicacoes": [
        "GET /me/notifications",
        "PATCH /me/notifications/{id}",
        "GET /me/notification-preferences",
        "PATCH /me/notification-preferences",
    ],
    "auditoria": [
        "GET /me/audit-events",
    ],
}


def http_api(api, functions, authorizer):
    routes = []
    for service, route_keys in ROUTES.items():
        fn = functions[service]
        integration = aws.apigatewayv2.Integration(
            f"{service}-integration",
            api_id=api.id,
            integration_type="AWS_PROXY",
            integration_method="POST",
            integration_uri=fn.invoke_arn,
            payload_format_version="2.0",
        )
        aws.lambda_.Permission(
            f"{service}-invoke",
            action="lambda:InvokeFunction",
            function=fn.name,
            principal="apigateway.amazonaws.com",
            source_arn=api.execution_arn.apply(lambda arn: f"{arn}/*/*"),
        )
        for route_key in route_keys:
            slug = route_key.lower().replace(" ", "-").replace("/", "-").replace("{", "").replace("}", "")
            public = route_key in ("GET /auth/google/start", "GET /auth/google/callback")
            routes.append(
                aws.apigatewayv2.Route(
                    f"route-{slug}",
                    api_id=api.id,
                    route_key=route_key,
                    authorization_type="NONE" if public else "JWT",
                    authorizer_id=None if public else authorizer.id,
                    target=integration.id.apply(lambda integration_id: f"integrations/{integration_id}"),
                )
            )
    stage = aws.apigatewayv2.Stage(
        "default",
        api_id=api.id,
        name="$default",
        auto_deploy=True,
        opts=pulumi.ResourceOptions(depends_on=routes),
    )
    pulumi.export("http_api", api.api_endpoint)
    return api, stage


def frontend_cdn(certificate_arn=None, aliases=None):
    bucket = aws.s3.Bucket(
        "frontend",
        bucket=f"{prefix}-frontend",
        force_destroy=not is_prod,
    )
    aws.s3.BucketPublicAccessBlock(
        "frontend-block",
        bucket=bucket.id,
        block_public_acls=True,
        block_public_policy=True,
        ignore_public_acls=True,
        restrict_public_buckets=True,
    )
    upload_frontend(bucket)
    oac = aws.cloudfront.OriginAccessControl(
        "frontend-oac",
        name=f"{prefix}-frontend",
        origin_access_control_origin_type="s3",
        signing_behavior="always",
        signing_protocol="sigv4",
    )
    if certificate_arn is None:
        viewer = aws.cloudfront.DistributionViewerCertificateArgs(
            cloudfront_default_certificate=True,
        )
        alias_args = {}
    else:
        viewer = aws.cloudfront.DistributionViewerCertificateArgs(
            acm_certificate_arn=certificate_arn,
            ssl_support_method="sni-only",
            minimum_protocol_version="TLSv1.2_2021",
        )
        alias_args = {"aliases": aliases}
    cache = aws.cloudfront.get_cache_policy(name="Managed-CachingOptimized")
    fresh = aws.cloudfront.get_cache_policy(name="Managed-CachingDisabled")
    distribution = aws.cloudfront.Distribution(
        "frontend",
        enabled=True,
        is_ipv6_enabled=True,
        comment=f"{prefix} frontend",
        origins=[
            aws.cloudfront.DistributionOriginArgs(
                origin_id="s3",
                domain_name=bucket.bucket_regional_domain_name,
                origin_access_control_id=oac.id,
            )
        ],
        default_root_object="index.html",
        default_cache_behavior=aws.cloudfront.DistributionDefaultCacheBehaviorArgs(
            target_origin_id="s3",
            viewer_protocol_policy="redirect-to-https",
            allowed_methods=["GET", "HEAD", "OPTIONS"],
            cached_methods=["GET", "HEAD"],
            compress=True,
            cache_policy_id=cache.id,
        ),
        ordered_cache_behaviors=[
            aws.cloudfront.DistributionOrderedCacheBehaviorArgs(
                path_pattern="index.html",
                target_origin_id="s3",
                viewer_protocol_policy="redirect-to-https",
                allowed_methods=["GET", "HEAD", "OPTIONS"],
                cached_methods=["GET", "HEAD"],
                compress=True,
                cache_policy_id=fresh.id,
            )
        ],
        restrictions=aws.cloudfront.DistributionRestrictionsArgs(
            geo_restriction=aws.cloudfront.DistributionRestrictionsGeoRestrictionArgs(
                restriction_type="none",
            )
        ),
        viewer_certificate=viewer,
        **alias_args,
    )
    aws.s3.BucketPolicy(
        "frontend-policy",
        bucket=bucket.id,
        policy=pulumi.Output.all(bucket.arn, distribution.arn).apply(
            lambda args: json.dumps(
                {
                    "Version": "2012-10-17",
                    "Statement": [
                        {
                            "Effect": "Allow",
                            "Principal": {"Service": "cloudfront.amazonaws.com"},
                            "Action": "s3:GetObject",
                            "Resource": f"{args[0]}/*",
                            "Condition": {"StringEquals": {"AWS:SourceArn": args[1]}},
                        }
                    ],
                }
            )
        ),
    )
    pulumi.export("frontend", distribution.domain_name)
    return distribution


def certificate(name, domain_name, alternative_names, provider=None):
    opts = pulumi.ResourceOptions(provider=provider) if provider else None
    cert = aws.acm.Certificate(
        name,
        domain_name=domain_name,
        subject_alternative_names=alternative_names or None,
        validation_method="DNS",
        opts=opts,
    )
    records = []
    count = 1 + len(alternative_names or [])
    for index in range(count):
        option = cert.domain_validation_options[index]
        records.append(
            aws.route53.Record(
                f"{name}-validation-{index}",
                zone_id=zone.zone_id,
                name=option.resource_record_name,
                type=option.resource_record_type,
                records=[option.resource_record_value],
                ttl=300,
                allow_overwrite=True,
            )
        )
    validation = aws.acm.CertificateValidation(
        f"{name}-ready",
        certificate_arn=cert.arn,
        validation_record_fqdns=[record.fqdn for record in records],
        opts=opts,
    )
    return validation


def prod_names(api, stage):
    use1 = aws.Provider("us-east-1", region="us-east-1")
    frontend_cert = certificate(
        "frontend-cert",
        domain,
        [f"www.{domain}"],
        provider=use1,
    )
    named = frontend_cdn(
        certificate_arn=frontend_cert.certificate_arn,
        aliases=[domain, f"www.{domain}"],
    )
    for hostname in (domain, f"www.{domain}"):
        slug = "apex" if hostname == domain else "www"
        for record_type in ("A", "AAAA"):
            aws.route53.Record(
                f"{slug}-{record_type.lower()}",
                zone_id=zone.zone_id,
                name=hostname,
                type=record_type,
                aliases=[
                    aws.route53.RecordAliasArgs(
                        name=named.domain_name,
                        zone_id=named.hosted_zone_id,
                        evaluate_target_health=False,
                    )
                ],
            )

    api_cert = certificate("api-cert", f"api.{domain}", [])
    api_domain = aws.apigatewayv2.DomainName(
        "api-domain",
        domain_name=f"api.{domain}",
        domain_name_configuration=aws.apigatewayv2.DomainNameDomainNameConfigurationArgs(
            certificate_arn=api_cert.certificate_arn,
            endpoint_type="REGIONAL",
            security_policy="TLS_1_2",
        ),
    )
    aws.apigatewayv2.ApiMapping(
        "api-mapping",
        api_id=api.id,
        domain_name=api_domain.domain_name,
        stage=stage.name,
        opts=pulumi.ResourceOptions(depends_on=[stage]),
    )
    aws.route53.Record(
        "api-a",
        zone_id=zone.zone_id,
        name=f"api.{domain}",
        type="A",
        aliases=[
            aws.route53.RecordAliasArgs(
                name=api_domain.domain_name_configuration.target_domain_name,
                zone_id=api_domain.domain_name_configuration.hosted_zone_id,
                evaluate_target_health=False,
            )
        ],
    )
    pulumi.export("api_hostname", f"api.{domain}")


def upload_frontend(bucket):
    game = root.parent / "flesh-to-chrome"
    subprocess.run(["npm", "install"], cwd=game, check=True)
    subprocess.run(["npm", "run", "build"], cwd=game, check=True)
    dist = game / "dist"
    files = [path for path in dist.rglob("*") if path.is_file()]
    if not files:
        raise Exception("O build do frontend não gerou arquivos.")
    for path in files:
        key = path.relative_to(dist).as_posix()
        guessed = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        if guessed.startswith("text/") or guessed in ("application/javascript", "application/json"):
            guessed = f"{guessed}; charset=utf-8"
        aws.s3.BucketObjectv2(
            "frontend-index" if key == "index.html" else f"frontend-{hashlib.sha1(key.encode()).hexdigest()[:12]}",
            bucket=bucket.id,
            key=key,
            source=pulumi.FileAsset(str(path)),
            content_type=guessed,
            cache_control="no-cache" if key == "index.html" else "public, max-age=86400",
        )


def players(api):
    region = pulumi.Config("aws").get("region") or "sa-east-1"
    google_id = config.get("googleClientId")
    google_secret = config.get_secret("googleClientSecret")
    google_enabled = bool(google_id) and google_secret is not None
    pool = aws.cognito.UserPool(
        "players",
        name=f"{prefix}-players",
        username_attributes=["email"],
        auto_verified_attributes=["email"],
        admin_create_user_config=aws.cognito.UserPoolAdminCreateUserConfigArgs(
            allow_admin_create_user_only=True,
        ),
    )
    aws.cognito.UserPoolDomain(
        "players-domain",
        domain=f"ftc-{stack}-legere",
        user_pool_id=pool.id,
    )
    google = None
    if google_enabled:
        google = aws.cognito.IdentityProvider(
            "google",
            user_pool_id=pool.id,
            provider_name="Google",
            provider_type="Google",
            provider_details=pulumi.Output.all(google_id, google_secret).apply(
                lambda values: {
                    "client_id": values[0],
                    "client_secret": values[1],
                    "authorize_scopes": "openid email profile",
                }
            ),
            attribute_mapping={"email": "email", "name": "name", "username": "sub"},
        )
    oauth = {}
    if google_enabled:
        callbacks = [pulumi.Output.concat(api.api_endpoint, "/auth/google/callback")]
        if is_prod and publish_domain:
            callbacks.append(f"https://api.{domain}/auth/google/callback")
        oauth = {
            "allowed_oauth_flows_user_pool_client": True,
            "allowed_oauth_flows": ["code"],
            "allowed_oauth_scopes": ["openid", "email", "profile"],
            "supported_identity_providers": ["Google"],
            "callback_urls": callbacks,
        }
    client = aws.cognito.UserPoolClient(
        "players-client",
        name=f"{prefix}-web",
        user_pool_id=pool.id,
        generate_secret=True,
        explicit_auth_flows=["ALLOW_REFRESH_TOKEN_AUTH"],
        prevent_user_existence_errors="ENABLED",
        enable_token_revocation=True,
        opts=pulumi.ResourceOptions(depends_on=[google]) if google else None,
        **oauth,
    )
    authorizer = aws.apigatewayv2.Authorizer(
        "jwt",
        api_id=api.id,
        authorizer_type="JWT",
        name=f"{prefix}-jwt",
        identity_sources=["$request.header.Authorization"],
        jwt_configuration=aws.apigatewayv2.AuthorizerJwtConfigurationArgs(
            issuer=pool.id.apply(lambda pool_id: f"https://cognito-idp.{region}.amazonaws.com/{pool_id}"),
            audiences=[client.id],
        ),
    )
    pulumi.export("login_domain", f"ftc-{stack}-legere.auth.{region}.amazoncognito.com")
    return pool, client, authorizer, google_enabled


def prod_mail():
    identity = aws.ses.DomainIdentity("ses-domain", domain=domain)
    dkim = aws.ses.DomainDkim("ses-dkim", domain=identity.domain)
    aws.route53.Record(
        "ses-verification",
        zone_id=zone.zone_id,
        name=f"_amazonses.{domain}",
        type="TXT",
        ttl=600,
        records=[identity.verification_token.apply(lambda token: f'"{token}"')],
    )
    for index in range(3):
        token = dkim.dkim_tokens.apply(lambda values, index=index: values[index])
        aws.route53.Record(
            f"ses-dkim-{index}",
            zone_id=zone.zone_id,
            name=token.apply(lambda value: f"{value}._domainkey.{domain}"),
            type="CNAME",
            ttl=600,
            records=[token.apply(lambda value: f"{value}.dkim.amazonses.com")],
        )


def open_api():
    return aws.apigatewayv2.Api(
        "http",
        name=f"{prefix}-http",
        protocol_type="HTTP",
        cors_configuration=aws.apigatewayv2.ApiCorsConfigurationArgs(
            allow_origins=["*"] if not is_prod else [f"https://{domain}", f"https://www.{domain}"],
            allow_methods=["GET", "POST", "PUT", "PATCH", "OPTIONS"],
            allow_headers=["authorization", "content-type"],
        ),
    )


services = {
    "conta": table("accounts"),
    "campanha": table("campaigns"),
    "partidas": table("matches", with_ttl=True),
    "comunicacoes": table("communications"),
    "auditoria": table("audit"),
}

if is_prod and publish_domain:
    prod_mail()
elif config.get("sesFromEmail"):
    aws.ses.EmailIdentity("ses-from", email=config.get("sesFromEmail"))

api = open_api()
pool, client, authorizer, google_enabled = players(api)
login_host = pulumi.Output.concat("ftc-", stack, "-legere.auth.", pulumi.Config("aws").get("region") or "sa-east-1", ".amazoncognito.com")
ses_from = f"noreply@{domain}" if is_prod and publish_domain else (config.get("sesFromEmail") or "")
mail_env = {"SES_FROM": ses_from} if ses_from else {}
functions = {}
functions["comunicacoes"] = publish("comunicacoes", services["comunicacoes"], mail_env)
functions["campanha"] = publish("campanha", services["campanha"])
functions["partidas"] = publish("partidas", services["partidas"])
functions["auditoria"] = publish("auditoria", services["auditoria"])
functions["conta"] = publish(
    "conta",
    services["conta"],
    {
        "COGNITO_DOMAIN": login_host,
        "COGNITO_CLIENT_ID": client.id,
        "COGNITO_CLIENT_SECRET": client.client_secret,
        "GOOGLE_ENABLED": "true" if google_enabled else "false",
        "COMUNICACOES_FUNCTION_NAME": functions["comunicacoes"].name,
    },
    invoke_function=functions["comunicacoes"],
)
api_resource, stage = http_api(api, functions, authorizer)
if is_prod and publish_domain:
    prod_names(api_resource, stage)
else:
    frontend_cdn()
