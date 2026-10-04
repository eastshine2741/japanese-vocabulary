resource "hcloud_placement_group" "main" {
  name = var.placement_group_name
  type = "spread"
}

resource "hcloud_server" "node" {
  count = var.node_count

  name               = "${var.name_prefix}-${count.index + 1}"
  server_type        = var.server_type
  image              = var.image
  location           = var.location
  placement_group_id = hcloud_placement_group.main.id
  ssh_keys           = var.ssh_keys

  lifecycle {
    # ssh_keys 변경은 서버를 교체(ForceNew)하는데 import한 노드는 state에 값이 없어 무시해야 한다.
    ignore_changes = [ssh_keys]
  }
}

# 서버 생성 후 private network에 붙인다. Hetzner 이미지의 hc-utils가 새 NIC를 DHCP로 올린다.
resource "hcloud_server_network" "node" {
  count = var.node_count

  server_id  = hcloud_server.node[count.index].id
  network_id = var.network_id
  ip         = var.private_ips[count.index]
}
