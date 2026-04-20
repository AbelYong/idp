# OpenID-IdP #

Este repositorio es un IdP desarrollado para el sistema *Gazella*, utilizando `oidc-provider`.

## Endpoints ##

## Instalando el sistema ##

Clone el repositorio y ejecute `npm install`.

Cree su archivo .env:

```text
DB_USER=
DB_NAME=
DATABASE_URL=postgresql://[DB_USER]:[Password]@[CONTAINER_NAME]:5432/[DB_NAME]
PORT=
NODE_ENV=PRODUCTION
ISSUER_URL=[URL donde esta hosteado el IdP]
OIDC_JWKS=[JSON Valido]
DEFAULT_RESOURCE=[Cliente al que otorgar grants automaticos]
DEFAULT_SCOPES=[scopes, separados por comas]
IDP_EMAIL_ADDRESS=[direccion de correo para verificacion y recuperacion]
IDP_EMAIL_PASS=[contraseña del correo]
```

Cree un archivo llamado pg_password.txt en la raíz del proyecto, dentro coloque una sola linea con la contraseña de la BD

Genere el script de la base de datos en .sql

```bash
npm run db:generate
```

Genere y levante el contenedor

```bash
docker compose up --build
```
