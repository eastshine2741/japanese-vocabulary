# 프로필 사진 버킷. dev 네임스페이스들은 kotonoha-dev 하나를 같이 쓴다 (key 가 UUID 라 충돌 없음).
resource "cloudflare_r2_bucket" "images" {
  for_each = toset(["kotonoha-prod", "kotonoha-dev"])

  account_id = var.cloudflare_account_id
  name       = each.key
  location   = "weur"
}

# 커스텀 도메인을 붙이면 Cloudflare 가 DNS 레코드를 직접 관리하므로 module.dns 에 넣지 않는다.
resource "cloudflare_r2_custom_domain" "images" {
  for_each = {
    "kotonoha-prod" = "img.kotonoha.eastshine.dev"
    "kotonoha-dev"  = "img-dev.kotonoha.eastshine.dev"
  }

  account_id  = var.cloudflare_account_id
  bucket_name = cloudflare_r2_bucket.images[each.key].name
  domain      = each.value
  zone_id     = data.cloudflare_zone.main.zone_id
  enabled     = true
}
