data "cloudflare_zone" "main" {
  filter = {
    name = var.cloudflare_zone_name
  }
}
