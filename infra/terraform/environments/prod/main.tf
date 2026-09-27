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

  name_prefix          = "ubuntu-4gb-hel1"
  node_count           = 4
  server_type          = "cx23"
  image                = "ubuntu-24.04"
  location             = "hel1"
  placement_group_name = "kotonoha-spread"
  ssh_keys             = ["eastshine-desktop"]
  network_id           = hcloud_network.main.id
  # hel1-1(control-plane), hel1-2, hel1-3, hel1-4 순. 기존 노드는 실제 할당된 IP 그대로
  private_ips = ["10.0.0.2", "10.0.0.4", "10.0.0.3", "10.0.0.5"]

  depends_on = [hcloud_network_subnet.main]
}

# 기존 노드 3대의 network 연결은 콘솔에서 만든 것 — state로 가져온다 (ID: <server-id>-<network-id>)
import {
  to = module.k3s_node_pool.hcloud_server_network.node[0]
  id = "131415888-12230743"
}

import {
  to = module.k3s_node_pool.hcloud_server_network.node[1]
  id = "131415889-12230743"
}

import {
  to = module.k3s_node_pool.hcloud_server_network.node[2]
  id = "131415890-12230743"
}
