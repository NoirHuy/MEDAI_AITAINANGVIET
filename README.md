---
title: MedChat AI
emoji: 🩺
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 4000
tags:
  - health
  - medical
  - knowledge-graph
  - neo4j
  - bayesian
  - differential-diagnosis
  - vietnamese
license: mit
short_description: Hệ thống trợ lý chẩn đoán phân biệt tích hợp Knowledge Graph
---


# MedAI

**MedAI** là hệ thống trợ lý chẩn đoán phân biệt chuyên nghiệp thế hệ mới. Khác biệt với các chatbot y tế thông thường dễ bị ảo tưởng (hallucination) dữ liệu, MedAI kết hợp **Đồ thị tri thức y khoa lâm sàng (Knowledge Graph)**, **Mạng xác suất Bayesian** và **Mô hình ngôn ngữ lớn (LLM)** để đưa ra các tư vấn sàng lọc bệnh lý có dẫn chứng y học chứng cứ, cá nhân hóa theo dịch tễ học và an toàn cho người dùng.

---

## 🩺 Cấu trúc Đồ thị Tri thức Y khoa (Knowledge Graph)
Hệ thống vận hành trên nền tảng cơ sở dữ liệu đồ thị tri thức **Neo4j** (grounded trên tập dữ liệu SymCAT/Synthea) bao gồm:
*   **474 Nút Triệu chứng (Symptom nodes)**: Mô tả các biểu hiện lâm sàng chuẩn hóa.
*   **801 Nút Bệnh lý (Disease nodes)**: Danh mục các bệnh lý phổ biến và hiếm gặp.
*   **Hơn 20.000 Quan hệ liên kết (`HAS_SYMPTOM`)**: Nối các bệnh lý với triệu chứng đi kèm thuộc tính **xác suất dịch tễ (`probability`)** thực tế thu thập từ lịch sử bệnh án lâm sàng.
*   **Mối liên hệ nhân khẩu học (`AFFECTS_AGE`, `AFFECTS_SEX`)**: Thống kê tỷ lệ phân bố bệnh theo nhóm tuổi và giới tính.

---

## 🚀 Công nghệ

### 1. Chuẩn hóa thực thể đa tầng (UMLS Semantic Mapping)
Người dùng có thể nhập mô tả bằng tiếng Việt bình dân (ví dụ: *"khát khô cổ"*, *"nóng hâm hập về chiều"*). Hệ thống sẽ tự động chuyển đổi thuật ngữ tự nhiên sang Medical English, tra cứu mã thực thể CUI chuẩn hóa của NIH UMLS API để ánh xạ chính xác vào đồ thị Neo4j.
$$\text{Tiếng Việt bình dân} \xrightarrow{\text{LLM}} \text{Medical English} \xrightarrow{\text{UMLS API}} \text{Mã CUI chuẩn NIH} \xrightarrow{\text{LLM Verify}} \text{SymCAT Slugs}$$

### 2. Thuật toán Bayesian Scoring & Point Penalty (Xử lý phủ định triệu chứng)
Khi người dùng phủ nhận triệu chứng (ví dụ: *"tôi không bị ho"*, *"không khó thở"*), đồ thị tri thức sẽ tự động áp dụng cơ chế **Bayesian Point Penalty** để trừ điểm và hạ rank bệnh lý nghi ngờ đó ngay lập tức. Điều này giúp loại trừ các bệnh không phù hợp cực kỳ nhạy.

### 3. Hỏi bệnh dựa trên Entropy (Information Gain Questions)
Hệ thống sử dụng toán học trên đồ thị để tính toán **Độ lệch chuẩn (Standard Deviation)** xác suất của các triệu chứng chưa khám phá. Hệ thống sẽ chủ động tìm triệu chứng có tính chất phân biệt cao nhất giữa top các bệnh nghi ngờ và yêu cầu LLM hỏi tiếp triệu chứng này, giúp rút ngắn thời gian chẩn đoán phân biệt.

---

## 🛠️ Công nghệ tích hợp (Tech Stack)

*   **Frontend**: React 19 + Vite, Vanilla CSS tối ưu tốc độ và khả năng tùy biến giao diện.
*   **Backend**: Node.js Express Server, tích hợp Driver kết nối Neo4j, JWT Session Security.
*   **Database**: Neo4j AuraDB (Đồ thị tri thức lưu trữ Cloud).
*   **AI Model**: OpenRouter API (`deepseek/deepseek-v4-flash`) cho tốc độ stream nhanh vượt trội.
*   **Medical API**: NLM UTS UMLS REST API.

---

## 📦 Hướng dẫn chạy thử nghiệm local (Local Development)

Yêu cầu chạy song song 2 server:

```bash
# 1. Cấu hình & Chạy Backend (Cổng http://localhost:4000)
cd back_end
cp .env.example .env   # Điền API Keys (OpenRouter, Neo4j, UMLS) vào .env
npm install
npm run dev

# 2. Cấu hình & Chạy Frontend (Cổng http://localhost:5173)
cp .env.example .env
npm install
npm run dev
```

---

*MedAI — Trực quan hóa tri thức y học, nâng tầm chẩn đoán lâm sàng.*
