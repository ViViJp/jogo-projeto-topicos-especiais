import json

import pulumi
import pulumi_aws as aws

if pulumi.get_stack() == "prod":
    zone = aws.route53.Zone(
        "flesh-to-chrome",
        name="flesh-to-chrome.negoci.online",
    )
    pulumi.export("nameservers", zone.name_servers)

    table = aws.dynamodb.Table(
        "campanha",
        name="flesh-to-chrome-campanha",
        attributes=[aws.dynamodb.TableAttributeArgs(name="id", type="S")],
        hash_key="id",
        billing_mode="PAY_PER_REQUEST",
    )

    role = aws.iam.Role(
        "campanha-role",
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
        "campanha-logs",
        role=role.name,
        policy_arn="arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
    )

    aws.iam.RolePolicy(
        "campanha-dynamodb",
        role=role.id,
        policy=table.arn.apply(
            lambda arn: json.dumps(
                {
                    "Version": "2012-10-17",
                    "Statement": [
                        {
                            "Effect": "Allow",
                            "Action": ["dynamodb:GetItem", "dynamodb:PutItem"],
                            "Resource": arn,
                        }
                    ],
                }
            )
        ),
    )

    fn = aws.lambda_.Function(
        "campanha",
        name="flesh-to-chrome-campanha",
        runtime=aws.lambda_.Runtime.PYTHON3D13,
        handler="handler.lambda_handler",
        role=role.arn,
        code=pulumi.FileArchive("./campanha"),
        timeout=10,
        environment=aws.lambda_.FunctionEnvironmentArgs(
            variables={"TABLE_NAME": table.name},
        ),
    )

    pulumi.export("table_name", table.name)
    pulumi.export("function_name", fn.name)
