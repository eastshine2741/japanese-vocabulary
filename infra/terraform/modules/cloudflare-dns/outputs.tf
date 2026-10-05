output "record_hostnames" {
  value = { for k, v in cloudflare_dns_record.records : k => v.name }
}
