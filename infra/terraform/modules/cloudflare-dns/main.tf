resource "cloudflare_dns_record" "records" {
  for_each = var.records

  zone_id = var.zone_id
  name    = each.value.name
  type    = each.value.type
  ttl     = each.value.ttl
  content = each.value.content
  proxied = each.value.proxied
}
