# requires -RunAsAdministrator - this script for windows os only 

# Read variables from .env file
Get-Content .env | Where-Object { $_ -notmatch '^\s*#' -and $_ -match '=' } | ForEach-Object {
    $name, $value = $_.Split('=', 2)
    Set-Variable -Name $name -Value $value
}

$domains = $DOMAIN
$email = $CERTBOT_EMAIL
$staging = 0 # Set to 1 if you're testing your setup to avoid hitting request limits

$data_path = "./certbot"

Write-Host "### Creating dummy certificate for $domains ..."
docker compose run --rm --entrypoint "sh -c `"mkdir -p /etc/letsencrypt/live/$domains && openssl req -x509 -nodes -newkey rsa:4096 -days 1 -keyout /etc/letsencrypt/live/$domains/privkey.pem -out /etc/letsencrypt/live/$domains/fullchain.pem -subj '/CN=localhost'`"" certbot
Write-Host ""

Write-Host "### Starting nginx ..."
docker compose up --force-recreate -d nginx
Write-Host ""

Write-Host "### Deleting dummy certificate for $domains ..."
docker compose run --rm --entrypoint "rm -Rf /etc/letsencrypt/live/$domains && rm -Rf /etc/letsencrypt/archive/$domains && rm -Rf /etc/letsencrypt/renewal/$domains.conf" certbot
Write-Host ""

Write-Host "### Requesting Let's Encrypt certificate for $domains ..."
$staging_arg = if ($staging -eq 1) { "--staging" } else { "" }
docker compose run --rm --entrypoint "certbot certonly --webroot -w /var/www/certbot $staging_arg -d $domains --email $email --rsa-key-size 4096 --agree-tos --force-renewal --non-interactive" certbot
Write-Host ""

Write-Host "### Reloading nginx ..."
docker compose exec nginx nginx -s reload
