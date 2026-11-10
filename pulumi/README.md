# Campanha na AWS (Pulumi)

Stack da disciplina de nuvem. Sobe, na stack `prod`:

- zona Route 53 `flesh-to-chrome.negoci.online`
- tabela DynamoDB `flesh-to-chrome-campanha`
- Lambda `flesh-to-chrome-campanha` (`campanha/handler.py`)

Fora da stack `prod` o programa não cria recurso.

## Rodar

Credenciais AWS no ambiente (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION=sa-east-1`) e `pulumi login`.

```bash
cd pulumi
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pulumi stack select prod --create
pulumi preview
pulumi up
```

Região da stack: `sa-east-1`, em `Pulumi.prod.yaml`.
