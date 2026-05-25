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

resource "hcloud_network" "main" {
  name     = "kotonoha-net"
  ip_range = "10.0.0.0/16"
}

resource "hcloud_network_subnet" "main" {
  network_id   = hcloud_network.main.id
  type         = "cloud"
  network_zone = "eu-central"
  ip_range     = "10.0.0.0/24"
}

module "k3s_node_pool" {
  source = "../../modules/k3s-node-pool"

  name_prefix = "ubuntu-4gb-hel1"
  node_count = 3
  server_type = "cx23"
  image = "ubuntu-24.04"
  location = "hel1"
  placement_group_name = "kotonoha-spread"
}
