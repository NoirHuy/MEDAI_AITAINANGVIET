#!/usr/bin/env bash
# ==============================================================================
# 🚀 MedChat247 — Production VPS Deployment Script
# ==============================================================================
set -euo pipefail

# Color codes for formatting output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

echo -e "${BLUE}=====================================================${NC}"
echo -e "${GREEN}   🩺 MedChat247 — VPS Automated Deployment Setup   ${NC}"
echo -e "${BLUE}=====================================================${NC}\n"

# 1. Check Root / Sudo privileges
SUDO=""
if [ "$EUID" -ne 0 ]; then
  if command -v sudo &>/dev/null; then
    SUDO="sudo"
  else
    log_error "Vui lòng chạy script với quyền root hoặc sudo."
    exit 1
  fi
fi

# 2. Check & Install Docker / Docker Compose if missing
if ! command -v docker &>/dev/null; then
  log_warn "Docker chưa được cài đặt. Đang tiến hành cài đặt Docker chính thức..."
  curl -fsSL https://get.docker.com -o get-docker.sh
  $SUDO sh get-docker.sh
  rm -f get-docker.sh
  $SUDO systemctl enable --now docker
  log_success "Đã cài đặt Docker thành công."
else
  log_info "Docker đã sẵn sàng: $(docker --version)"
fi

if ! docker compose version &>/dev/null; then
  log_warn "Docker Compose plugin chưa được tìm thấy. Đang cài đặt..."
  $SUDO apt-get update && $SUDO apt-get install -y docker-compose-plugin || {
    log_error "Không thể tự động cài docker-compose-plugin. Vui lòng cài đặt trước."
    exit 1
  }
fi
log_info "Docker Compose đã sẵn sàng: $(docker compose version)"

# 3. Configure Firewall (UFW) if enabled
if command -v ufw &>/dev/null && $SUDO ufw status | grep -q "Status: active"; then
  log_info "Phát hiện tường lửa UFW đang kích hoạt. Mở các cổng cần thiết..."
  $SUDO ufw allow 22/tcp comment "SSH" || true
  $SUDO ufw allow 80/tcp comment "HTTP / ACME Let's Encrypt" || true
  $SUDO ufw allow 443/tcp comment "HTTPS" || true
  $SUDO ufw allow 20128/tcp comment "9Router Dashboard" || true
  log_success "Đã mở cổng 22, 80, 443, 20128 trên UFW."
fi

# 4. Check & Setup Root .env
if [ ! -f .env ]; then
  log_warn "Không tìm thấy file .env tại thư mục gốc. Đang tạo từ .env.example..."
  if [ -f .env.example ]; then
    cp .env.example .env
  else
    touch .env
  fi

  # Prompt or set Domain
  read -r -p "👉 Nhập tên miền (Domain) của bạn [Ví dụ: medchat247.com]: " USER_DOMAIN
  USER_DOMAIN=${USER_DOMAIN:-medchat247.com}
  sed -i "s/DOMAIN=.*/DOMAIN=${USER_DOMAIN}/g" .env || echo "DOMAIN=${USER_DOMAIN}" >> .env

  # Generate random strong passwords
  MONGO_PASS=$(openssl rand -hex 16)
  REDIS_PASS=$(openssl rand -hex 16)
  NEO4J_PASS=$(openssl rand -hex 16)

  sed -i "s/MONGO_ROOT_PASS=.*/MONGO_ROOT_PASS=${MONGO_PASS}/g" .env || echo "MONGO_ROOT_PASS=${MONGO_PASS}" >> .env
  sed -i "s/REDIS_PASSWORD=.*/REDIS_PASSWORD=${REDIS_PASS}/g" .env || echo "REDIS_PASSWORD=${REDIS_PASS}" >> .env
  sed -i "s/NEO4J_AUTH=.*/NEO4J_AUTH=neo4j\/${NEO4J_PASS}/g" .env || echo "NEO4J_AUTH=neo4j/${NEO4J_PASS}" >> .env

  log_success "Đã khởi tạo file .env với mật khẩu container an toàn."
else
  log_info "File .env tại root đã tồn tại."
fi

# Load variables from root .env
set -a
# shellcheck disable=SC1091
source .env
set +a

# 5. Check & Setup back_end/.env
if [ ! -f back_end/.env ]; then
  log_warn "Không tìm thấy back_end/.env. Đang tạo từ back_end/.env.example..."
  if [ -f back_end/.env.example ]; then
    cp back_end/.env.example back_end/.env
  else
    log_error "Thiếu file back_end/.env.example."
    exit 1
  fi

  # Generate secrets
  JWT_SEC=$(openssl rand -hex 32)
  MEM_KEY=$(openssl rand -hex 32)

  sed -i "s/CLIENT_ORIGIN=.*/CLIENT_ORIGIN=https:\/\/${DOMAIN}/g" back_end/.env
  sed -i "s/COOKIE_SECURE=.*/COOKIE_SECURE=true/g" back_end/.env
  sed -i "s/JWT_SECRET=.*/JWT_SECRET=${JWT_SEC}/g" back_end/.env
  sed -i "s/MEMORY_ENCRYPTION_KEY=.*/MEMORY_ENCRYPTION_KEY=${MEM_KEY}/g" back_end/.env
  
  if [ -n "${NEO4J_AUTH:-}" ]; then
    NEO_PASS_ONLY="${NEO4J_AUTH#*/}"
    sed -i "s/NEO4J_PASSWORD=.*/NEO4J_PASSWORD=${NEO_PASS_ONLY}/g" back_end/.env
  fi

  log_success "Đã khởi tạo back_end/.env. Nhớ cập nhật thêm các API key (OpenRouter, Google, PayPal, SMTP)."
else
  log_info "File back_end/.env đã tồn tại."
fi

# 6. Build and Start Containers
log_info "Bắt đầu build và khởi động toàn bộ Docker Compose Stack (Production Mode)..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# 7. Health check loop
log_info "Đang chờ các dịch vụ khởi động và vượt qua Healthcheck..."
MAX_RETRIES=15
COUNT=0
HEALTHY=false

while [ $COUNT -lt $MAX_RETRIES ]; do
  COUNT=$((COUNT + 1))
  sleep 4
  if curl -k -s "http://127.0.0.1:8080/api/monitoring/health" | grep -q '"status":"ok"'; then
    HEALTHY=true
    break
  fi
  echo -n "."
done
echo ""

if [ "$HEALTHY" = true ]; then
  log_success "Hệ thống MedChat247 đã khởi động và kiểm tra sức khỏe thành công (200 OK)!"
else
  log_warn "Hệ thống đang khởi động hoặc kiểm tra sức khỏe chưa hoàn tất. Kiểm tra lại bằng: docker compose logs -f backend"
fi

# 8. Print Summary
echo -e "\n${BLUE}=====================================================${NC}"
echo -e "${GREEN}             🎉 TRIỂN KHAI HOÀN TẤT                 ${NC}"
echo -e "${BLUE}=====================================================${NC}"
echo -e "🌐 Trang chủ & Web App:    ${GREEN}https://${DOMAIN}${NC}"
echo -e "📊 Trang Quản trị Admin:   ${GREEN}https://${DOMAIN}/admin${NC}"
echo -e "🔀 9Router AI Dashboard:   ${GREEN}http://<IP_VPS>:20128${NC}"
echo -e "❤️ Healthcheck:            ${GREEN}https://${DOMAIN}/api/monitoring/health${NC}"
echo -e "${BLUE}-----------------------------------------------------${NC}"
echo -e "💡 Các lệnh hữu ích:"
echo -e "  - Xem log backend:       ${YELLOW}docker compose logs -f backend${NC}"
echo -e "  - Xem log Caddy (SSL):   ${YELLOW}docker compose logs -f caddy${NC}"
echo -e "  - Gán quyền Admin:       ${YELLOW}docker compose exec backend node scripts/promote-admin.js <email>${NC}"
echo -e "  - Khởi động lại:         ${YELLOW}docker compose -f docker-compose.yml -f docker-compose.prod.yml restart${NC}"
echo -e "${BLUE}=====================================================${NC}\n"
