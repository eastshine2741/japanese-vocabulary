data "cloudflare_zone" "main" {
  filter = {
    name = var.cloudflare_zone_name
  }
}

resource "cloudflare_dns_record" "kotonoha" {
  zone_id = data.cloudflare_zone.main.zone_id
  name    = "kotonoha.eastshine.dev"
  ttl     = 1
  type    = "A"
  content = "65.109.222.159"
  proxied = true
}

resource "cloudflare_dns_record" "api_kotonoha" {
  zone_id = data.cloudflare_zone.main.zone_id
  name    = "api.kotonoha.eastshine.dev"
  ttl     = 1
  type    = "A"
  content = "65.109.222.159"
  proxied = false
}
