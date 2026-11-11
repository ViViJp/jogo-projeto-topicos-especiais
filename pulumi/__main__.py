import json
import subprocess
from pathlib import Path

import pulumi
import pulumi_aws as aws

stack = pulumi.get_stack()
if stack not in ("dev", "prod"):
    raise Exception("A stack precisa se chamar dev ou prod.")

prefix = f"flesh-to-chrome-{stack}"
services_dir = Path(__file__).parent / "services"
domain = "nihil-legere-possum.lat"

if stack == "prod":
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


def publish(service, table_resource):
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
    fn = aws.lambda_.Function(
        service,
        name=f"{prefix}-{service}",
        runtime=aws.lambda_.Runtime.NODE_JS22D_X,
        handler="index.handler",
        role=role.arn,
        code=pulumi.FileArchive(str(path)),
        timeout=10,
        environment=aws.lambda_.FunctionEnvironmentArgs(
            variables={"TABLE_NAME": table_resource.name},
        ),
    )
    pulumi.export(f"{service}_function", fn.name)
    pulumi.export(f"{service}_table", table_resource.name)
    return fn


services = {
    "conta": table("accounts"),
    "campanha": table("campaigns"),
    "partidas": table("matches", with_ttl=True),
    "comunicacoes": table("communications"),
    "auditoria": table("audit"),
}

for service, table_resource in services.items():
    publish(service, table_resource)
