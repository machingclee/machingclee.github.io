const e=`---
title: "Personal Study for Company's Technology on Networking: Private DNS with Route 53 + Tailscale"
date: 2026-04-10
id: blog0483
tag: tech
toc: true
intro: "Study networking"
indent: true
wip: true
---
<style>
  video {
    border-radius: 4px;
    max-width: 660px;
  }
  img {
    max-width: 660px !important;
  }
  table td:first-child, table th:first-child {
    min-width: 120px;
  }
</style>


### The Goal

A custom internal domain like \`https://james.internal\` resolves to a private IP inside your AWS VPC. It is **invisible to the public internet** — a public DNS server has no record of it. You need Tailscale running to reach it from your laptop.

---

### Route 53 Private Hosted Zone

A **Private Hosted Zone** in Route 53 is a DNS zone that is attached to one or more VPCs. AWS's built-in VPC resolver (always at \`VPC_CIDR_BASE + 2\`, e.g. \`10.0.0.2\`) answers queries for it — but only from within that VPC.

\`\`\`
Inside VPC:   james.internal  →  10.0.4.55   ✓ (answered by Route 53 VPC resolver)
Your laptop:  james.internal  →  NXDOMAIN    ✗ (public DNS has no record)
\`\`\`

To create one in Terraform:

\`\`\`hcl
# Route 53 Private Hosted Zone
resource "aws_route53_zone" "internal" {
  name = "james.internal"

  vpc {
    vpc_id = aws_vpc.main.id   # attach to your VPC
  }
}

# A record pointing to a private IP
resource "aws_route53_record" "james" {
  zone_id = aws_route53_zone.internal.zone_id
  name    = "james.internal"
  type    = "A"
  ttl     = 300
  records = ["10.0.4.55"]
}
\`\`\`

---

### Tailscale: WireGuard Mesh + Subnet Router

Tailscale builds a **WireGuard mesh VPN**. Each device (your laptop, EC2 instances) gets a virtual interface (\`utun\` on macOS, \`tailscale0\` on Linux) and a \`100.x.x.x\` IP.

The critical piece for reaching \`james.internal\` is the **subnet router** — a small EC2 instance inside the VPC that does two things:

1. **Advertises the VPC CIDR** (e.g. \`10.0.0.0/16\`) to all Tailscale peers — so your laptop can route \`10.x.x.x\` traffic through it
2. **Proxies DNS** — forwards \`*.internal\` queries to the VPC resolver at \`10.0.0.2\`

Setting up the subnet router on the EC2:

\`\`\`bash
# On the subnet router EC2 (Amazon Linux 2 / Ubuntu)
curl -fsSL https://tailscale.com/install.sh | sh
tailscale up \\
  --advertise-routes=10.0.0.0/16 \\
  --accept-dns=false

# Enable IP forwarding (required for subnet routing)
echo 'net.ipv4.ip_forward = 1' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
\`\`\`

In the Tailscale admin console, approve the subnet route for this device. Then enable DNS split on the admin console:

\`\`\`
DNS → Nameservers → Add nameserver
  Nameserver: 10.0.0.2          ← the VPC resolver
  Restrict to domain: internal  ← only *.internal goes here
\`\`\`

---

### Full Request Flow (Tailscale ON)

\`\`\`
Your laptop
  │
  │  1. DNS query: james.internal
  ▼
Tailscale client
  │  "*.internal" → forward to subnet router (split DNS rule)
  │
  ▼  (WireGuard encrypted tunnel, peer-to-peer)
Subnet router EC2 (inside VPC, 10.0.x.x / 100.x.x.x)
  │
  │  2. Forwards DNS query to 10.0.0.2 (Route 53 VPC resolver)
  ▼
Route 53 Private Hosted Zone
  │  james.internal → 10.0.4.55
  ▼
Subnet router returns 10.0.4.55 to your laptop

  3. Your laptop sends HTTPS request to 10.0.4.55
     → routed through WireGuard tunnel → subnet router → target host in VPC
\`\`\`

**When Tailscale is OFF:**
- \`*.internal\` DNS queries go to your ISP's public DNS → \`NXDOMAIN\`
- Traffic to \`10.x.x.x\` is not routable on the public internet → connection refused

---

### Three Required Pieces

| Component | Where it runs | Role |
|---|---|---|
| Route 53 Private Hosted Zone | AWS | Stores \`james.internal → 10.0.4.55\`, only resolves inside VPC |
| Tailscale subnet router | EC2 inside VPC | Bridges WireGuard tunnel ↔ VPC network, proxies \`*.internal\` DNS |
| Tailscale client | Your laptop | Splits DNS (\`*.internal\` → subnet router), routes \`10.x.x.x\` through tunnel |

**Note:** Tailscale's control plane (\`login.tailscale.com\`) only handles key exchange and peer discovery. Actual traffic travels **peer-to-peer** through WireGuard — it never passes through Tailscale's servers.

---

### WireGuard Mesh VPN

**WireGuard** is a modern VPN protocol — faster and simpler than OpenVPN/IPSec. It encrypts traffic between two machines using public/private key pairs.

**Mesh** means every device connects **directly to every other device**, rather than all traffic flowing through a central server.

**Traditional VPN (hub-and-spoke):**
\`\`\`
Laptop ──→ VPN Server ──→ EC2-A
                     ──→ EC2-B
                     ──→ EC2-C
\`\`\`
All packets go through the central server even if Laptop and EC2-A are geographically close. The server is a bottleneck and single point of failure.

**WireGuard mesh (what Tailscale builds):**
\`\`\`
Laptop ─────────────────→ EC2-A
  │                         │
  │   Tailscale             │
  │   control plane         │
  │   (key exchange only)   │
  │                         │
  ↓                         ↓
EC2-B ←─────────────── EC2-C
\`\`\`
After key exchange, each pair of devices talks **directly** over an encrypted WireGuard tunnel. Tailscale's servers never see the data. If a direct path is blocked by NAT/firewall, Tailscale falls back to its DERP relay servers, but direct is always preferred.

**How Tailscale bootstraps this:**
1. Each device registers with \`login.tailscale.com\`, uploads its WireGuard **public key** and current IP
2. Tailscale distributes all peer public keys to all devices
3. Your \`tailscale0\` interface gets a route for every \`100.x.x.x\` peer
4. Traffic between peers is **end-to-end encrypted** — Tailscale servers never see the content

---

### Traffic Routing: What Tailscale Intercepts

By default Tailscale operates in **split tunnel** mode — it does NOT capture all your internet traffic.

\`\`\`
Your laptop (Tailscale ON)
  │
  ├─ Traffic to 100.x.x.x (Tailscale IPs)  → WireGuard tunnel → peer devices
  ├─ Traffic to 10.0.0.0/16 (subnet route) → WireGuard tunnel → subnet router → VPC
  ├─ DNS query *.internal                  → WireGuard tunnel → subnet router → Route 53
  │
  └─ Everything else (google.com, etc.)    → your normal ISP, completely unaffected
\`\`\`

**Exit node mode (opt-in, full tunnel):**

If a device advertises itself as an exit node, you can optionally route **all** traffic through it:

\`\`\`bash
tailscale up --exit-node=100.64.0.5   # ALL traffic exits through this peer
\`\`\`

This behaves like a traditional VPN. It must be explicitly enabled — it is never the default.

| Traffic type | Default (split tunnel) | Exit node mode |
|---|---|---|
| \`100.x.x.x\` peers | → Tailscale tunnel | → Tailscale tunnel |
| Subnet routes (\`10.x.x.x\`) | → Tailscale tunnel | → Tailscale tunnel |
| \`*.internal\` DNS | → Tailscale tunnel | → Tailscale tunnel |
| Regular internet | → Your ISP (unchanged) | → Tailscale tunnel → exit node |

---

### Where the \`*.internal\` Split DNS Rule is Registered

The \`*.internal\` interception is **not automatic** — you register it once in the Tailscale admin console and it propagates to all devices:

\`\`\`
https://login.tailscale.com/admin/dns
  → Nameservers → Add nameserver
    → Custom
        Nameserver:          10.0.0.2     ← VPC resolver IP
        Restrict to domain:  internal     ← only *.internal goes here
\`\`\`

Tailscale pushes this rule to every device in the tailnet. On macOS, the client writes it into \`/etc/resolver/\`:

\`\`\`bash
cat /etc/resolver/internal
# nameserver 100.100.100.100   ← Tailscale's local DNS proxy, which forwards to 10.0.0.2
\`\`\`

macOS reads \`/etc/resolver/<domain>\` and routes queries for that domain to the specified nameserver. So \`james.internal\` → Tailscale local proxy → over the tunnel → VPC resolver.

**Summary of where each piece is configured:**

| What | Where |
|---|---|
| \`*.internal\` → route DNS to \`10.0.0.2\` | Tailscale admin console → DNS → Nameservers |
| \`10.0.0.0/16\` → route traffic to subnet router | Tailscale admin console → Machines → approve subnet route |
| \`/etc/resolver/internal\` on your Mac | Written automatically by Tailscale client after syncing admin config |

---

### Setting Up the Subnet Router EC2

The subnet router is a small EC2 instance inside the VPC. It needs four things configured correctly.

**AWS side — before installing Tailscale:**

| Requirement | Where to set it | Why |
|---|---|---|
| Security Group: UDP 41641 inbound | EC2 → Security Groups | WireGuard handshake port |
| Source/dest check: **disabled** | EC2 → Actions → Networking → Change source/dest check | EC2 must forward packets not addressed to itself |
| Outbound: all traffic allowed | Security Group | Route to VPC services and internet |

To disable source/dest check via AWS CLI:
\`\`\`bash
aws ec2 modify-instance-attribute \\
  --instance-id i-0abc123 \\
  --no-source-dest-check
\`\`\`

**EC2 setup — install and configure Tailscale:**

\`\`\`bash
# 1. Install Tailscale
curl -fsSL https://tailscale.com/install.sh | sh

# 2. Enable kernel IP forwarding (required for routing)
echo 'net.ipv4.ip_forward = 1'          | sudo tee -a /etc/sysctl.conf
echo 'net.ipv6.conf.all.forwarding = 1' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# 3. Start Tailscale as a subnet router
sudo tailscale up \\
  --advertise-routes=10.0.0.0/16 \\   # your VPC CIDR
  --accept-dns=false                  # don't overwrite this EC2's /etc/resolv.conf

# 4. Enable auto-start on reboot
sudo systemctl enable --now tailscaled
\`\`\`

\`--accept-dns=false\` is critical here: the EC2 already uses the VPC resolver (\`10.0.0.2\`) natively, and you don't want Tailscale replacing that.

**Tailscale admin console — two approvals required:**

\`\`\`
# Approve the subnet route
Machines → select this EC2 → Edit route settings → approve 10.0.0.0/16

# Add the split DNS rule
DNS → Nameservers → Add nameserver
  Nameserver: 10.0.0.2
  Restrict to domain: internal
\`\`\`

Without the subnet route approval, Tailscale will not advertise the route to other devices even though the EC2 requested it.

**What the subnet router does (summary):**

| Function | Mechanism |
|---|---|
| Route \`10.x.x.x\` traffic from your laptop into the VPC | \`--advertise-routes\` + admin approval |
| Resolve \`*.internal\` DNS for your laptop | Proxy DNS to \`10.0.0.2\` through the tunnel |
| Forward packets it doesn't own | Kernel \`ip_forward=1\` + EC2 source/dest check OFF |

---

### WireGuard Uses UDP

WireGuard (the protocol Tailscale is built on) uses **UDP exclusively** — it never uses TCP.

**Why UDP and not TCP?**

WireGuard handles its own reliability at the cryptographic layer, so it doesn't need TCP's overhead. UDP also avoids the **TCP-over-TCP problem**: if you tunnel TCP inside TCP, a dropped packet triggers two retransmit loops (inner + outer). With UDP as the carrier, only the inner TCP retransmits.

**Default port: UDP 41641** — Tailscale's WireGuard listen port. This is why the subnet router's security group needs UDP 41641 open.

**Fallback when UDP is blocked:**

If both peers are behind strict firewalls and a direct UDP path can't be established, Tailscale falls back to its **DERP relay servers** using HTTPS (TCP 443). Traffic still flows, just with higher latency. Direct UDP is always preferred and attempted first.

\`\`\`
Direct path available:   Laptop ──UDP 41641──→ EC2  (fast, peer-to-peer)
Direct path blocked:     Laptop ──HTTPS/443──→ DERP relay ──→ EC2  (fallback)
\`\`\`

Check which path is active:
\`\`\`bash
tailscale status
# shows "direct" or "relay" next to each peer
\`\`\`

---

### What is a Tailnet?

A **tailnet** is your private Tailscale network — the group of all devices joined under the same Tailscale account.

When you run \`tailscale up\` on any device and authenticate with your account, that device joins your tailnet. All devices in the same tailnet can see each other as peers, share the same \`100.x.x.x\` address space, and inherit the same ACL rules, DNS settings, and subnet routes configured in the admin console.

\`\`\`
Your tailnet (account: you@gmail.com)
  ├── MacBook Pro        100.64.0.1
  ├── Work laptop        100.64.0.2
  ├── Subnet router EC2  100.64.0.3  (advertises 10.0.0.0/16)
  └── Home server        100.64.0.4
\`\`\`

All four machines can reach each other via \`100.x.x.x\` regardless of physical location. The subnet router additionally bridges the whole VPC (\`10.x.x.x\`) into the tailnet. Admin console settings (subnet route approvals, split DNS rules) apply to the **entire tailnet** — registering \`*.internal\` once pushes it to all devices automatically.

---

### Tailnet Under the Hood: An Overlay Mesh Network

A **tailnet is an overlay mesh network** — two concepts combined:

**Overlay** means a virtual network built *on top of* the existing internet. The internet just carries encrypted UDP packets between machines — it has no idea what is inside them. Tailscale creates a separate virtual address space (\`100.x.x.x\`) that exists independently of where the machines physically are or what their real public IPs are:

\`\`\`
Physical reality (the internet):
  Laptop ──── encrypted UDP packets ────→ EC2
  (public IPs, ISP routing, NAT — machine-dependent)

What Tailscale presents (the overlay):
  Laptop (100.64.0.1) ←── virtual direct link ──→ EC2 (100.64.0.3)
  (flat 100.x.x.x space — location-independent)
\`\`\`

Your laptop never joins the AWS VPC. Instead, the subnet router EC2 has **two simultaneous identities**:
- A tailnet peer (\`100.64.0.3\`) — reachable from your laptop via WireGuard
- A real VPC member (\`10.0.4.55\`) — natively trusted by all other VPC resources

When you send traffic to a VPC private IP, your laptop sends it through the WireGuard tunnel to the subnet router, and the EC2 forwards it within the VPC as a normal VPC packet. Other VPC resources see traffic from a VPC IP — they are unaware of Tailscale.

**Mesh** means every node connects directly to every other node — no central relay required:

| | Hub-and-spoke (traditional VPN) | Mesh (Tailscale/WireGuard) |
|---|---|---|
| Laptop → EC2-A | Laptop → VPN server → EC2-A | Laptop → EC2-A directly |
| Two peers communicate | Always via central server | Peer-to-peer tunnel |
| Server goes down | Everything breaks | Only that peer is unreachable |

**In one sentence:** a tailnet is a WireGuard-encrypted virtual flat network (\`100.x.x.x\`) that rides on top of the internet, where every device talks directly to every other device — and the subnet router EC2 acts as the bridge into the VPC.

---

### Connecting Your Laptop to the Tailnet

**On macOS:**

\`\`\`bash
# 1. Install Tailscale
brew install tailscale

# 2. Start the daemon
sudo tailscaled &

# 3. Authenticate (opens browser → log in with your account)
tailscale up --accept-routes
\`\`\`

\`--accept-routes\` tells your laptop to accept the \`10.0.0.0/16\` subnet route advertised by the EC2. Without it, the route is known but ignored.

**Verify everything works:**

\`\`\`bash
# See all peers in your tailnet
tailscale status

# Confirm subnet route is active
tailscale status --peers | grep subnet

# Test internal DNS resolution
dig james.internal

# Test connectivity to a VPC private IP
ping 10.0.4.55
\`\`\`

---

### How the EC2 Joins the Same Tailnet (Auth Keys)

On a laptop you run \`tailscale up\` and a browser opens for login. On a headless EC2 there is no browser, so you use an **auth key** instead.

An auth key is a pre-authenticated token that belongs to your account — when the EC2 uses it, it joins your tailnet automatically.

\`\`\`
# 1. Generate an auth key in the admin console:
Settings → Keys → Generate auth key
  ✓ Reusable   ← check this if deploying multiple EC2s

# 2. On the EC2, pass the key at startup:
sudo tailscale up \\
  --authkey=tskey-auth-xxxxx \\
  --advertise-routes=10.0.0.0/16 \\
  --accept-dns=false
\`\`\`

| Device type | How it joins the tailnet |
|---|---|
| Laptop / desktop | \`tailscale up\` → browser login with your account |
| Headless server (EC2) | \`tailscale up --authkey=tskey-auth-xxxxx\` |

Both end up in the same tailnet because the auth key is issued by the same account.

---

### What Should \`james.internal\` Point To?

Route 53 Private Hosted Zone records must resolve to **private IPs** (\`10.x.x.x\`) or internal VPC DNS names. CloudFront and S3 are public internet services with no private IP inside your VPC — they cannot be used as direct targets for a \`*.internal\` record.

The correct pattern for an internal-only webpage is a **private server inside the VPC** that either serves or proxies the content:

| Option | Route 53 record | Best for |
|---|---|---|
| EC2/ECS running nginx | A record → private IP \`10.0.4.55\` | Simple static/dynamic site |
| Internal ALB → ECS | ALIAS record → internal ALB DNS name | Production, auto-scaling |
| nginx on EC2 proxying S3 | A record → nginx EC2 private IP | Static files in S3, internal-only access |

For the S3 approach: the S3 bucket stays **fully private** (no public access). nginx sits inside the VPC, fetches from S3 using the EC2's IAM role, and serves the response. From the outside only \`james.internal\` is reachable — and only through Tailscale.

---

### Hosting on \`james.internal\`: nginx as Static Server + API Proxy

The webpage needs to both serve static files **and** make API calls to K8s services. The cleanest solution is one nginx EC2 that handles both — serving the HTML/JS from disk and reverse-proxying API calls to an **internal ALB** in front of K8s. The browser only ever talks to \`james.internal\`, so there is no CORS issue.

**Why the subnet router EC2 is still required:**

K8s \`ClusterIP\` services are only reachable from within the cluster (pod network, \`172.x.x.x\`). To reach any VPC resource from your laptop — including an internal ALB — traffic must first enter the VPC through the subnet router EC2 via the WireGuard tunnel. The subnet router does not proxy at the HTTP layer; it only routes packets destined for \`10.0.0.0/16\` from the tunnel into the VPC.

**Architecture:**

\`\`\`
Browser on laptop (Tailscale ON)
  │
  ├─→ james.internal/          →  Route 53 PHZ  →  10.0.4.55 (nginx EC2)
  │                                                    │  serves static HTML/JS from disk
  │
  └─→ james.internal/api/      →  Route 53 PHZ  →  10.0.4.55 (nginx EC2)
                                                       │  proxy_pass ↓
                                                  internal ALB (10.0.5.x)
                                                       │
                                                  K8s Service → Pod

  All traffic: WireGuard tunnel → subnet router EC2 → VPC
\`\`\`

**Step 1 — Expose K8s via an internal ALB**

Use the AWS Load Balancer Controller with \`scheme: internal\` so the ALB gets a private IP inside the VPC:

\`\`\`yaml
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api-ingress
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internal        # private VPC IP only
    alb.ingress.kubernetes.io/target-type: ip
spec:
  rules:
    - http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: my-api-service
                port:
                  number: 80
\`\`\`

**Step 2 — Route 53 records**

\`\`\`hcl
# A record for nginx EC2 (serves static files + proxies API)
resource "aws_route53_record" "james" {
  zone_id = aws_route53_zone.internal.zone_id
  name    = "james.internal"
  type    = "A"
  ttl     = 300
  records = [aws_instance.nginx.private_ip]
}
\`\`\`

No separate DNS record is needed for the internal ALB — nginx resolves it by DNS name directly using the VPC resolver.

**Step 3 — nginx config**

\`\`\`nginx
# /etc/nginx/sites-available/james.internal
server {
    listen 80;
    server_name james.internal;

    # Serve static frontend files from disk
    location / {
        root /var/www/html;
        index index.html;
        try_files $uri $uri/ /index.html;   # SPA client-side routing
    }

    # Proxy API calls to internal ALB → K8s
    location /api/ {
        # Must use the VPC resolver so nginx re-resolves the ALB DNS on every request.
        # ALB IPs rotate — without this, nginx caches the IP at startup and breaks
        # when AWS reassigns it.
        resolver 10.0.0.2 valid=30s;
        set $backend "internal-alb-xxxxx.ap-east-1.elb.amazonaws.com";

        proxy_pass          http://$backend;
        proxy_set_header    Host              $host;
        proxy_set_header    X-Real-IP         $remote_addr;
        proxy_set_header    X-Forwarded-For   $proxy_add_x_forwarded_for;
    }
}
\`\`\`

**Why \`resolver 10.0.0.2\` and why a \`$backend\` variable:**

\`10.0.0.2\` is the AWS VPC DNS resolver — it is always placed at \`VPC_CIDR_BASE + 2\` (an AWS hard rule). By default nginx resolves \`proxy_pass\` hostnames **once at startup** and caches them forever. Internal ALB IPs rotate, so a stale cache will silently send traffic to a dead IP. Setting \`resolver\` plus using a \`set $backend\` variable forces nginx to re-resolve the hostname on every request, respecting the \`valid=30s\` TTL.

**Why no CORS:**

The browser fetches \`james.internal/\` (HTML) and later calls \`james.internal/api/users\`. Both are the same origin — \`james.internal\`. nginx on the same EC2 handles both paths, forwarding \`/api/\` upstream. The browser never contacts the ALB or K8s directly, so no \`Access-Control-Allow-Origin\` headers are needed.

**Access control summary:**

| Layer | What blocks public access |
|---|---|
| nginx EC2 | In a private subnet, no public IP |
| Internal ALB | \`scheme: internal\` — no public DNS, no public IP |
| K8s pods | ClusterIP only, unreachable outside cluster |
| Route 53 PHZ | \`james.internal\` only resolves inside the VPC |
| Tailscale | The VPC is only reachable via the WireGuard tunnel |

`;export{e as default};
