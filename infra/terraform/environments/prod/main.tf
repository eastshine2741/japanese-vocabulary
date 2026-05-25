data "cloudflare_zone" "main" {
  filter = {
    name = var.cloudflare_zone_name
  }
}

module "dns" {
  source = "../../modules/cloudflare-dns"

  zone_id = data.cloudflare_zone.main.zone_id
  records = {
    kotonoha = {
      name    = "kotonoha.eastshine.dev"
      type    = "A"
      ttl     = 1
      content = "65.109.222.159"
      proxied = true
    }
    api_kotonoha = {
      name    = "api.kotonoha.eastshine.dev"
      type    = "A"
      ttl     = 1
      content = "65.109.222.159"
      proxied = false
    }
  }
}
