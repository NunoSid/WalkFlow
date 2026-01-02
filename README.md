<div align="center">
  <img
    src="https://github.com/user-attachments/assets/7c6ecae8-ce9e-40f6-bb66-1c601ed4f977"
    width="672"
    height="448"
    alt="WalkFlow logo"
  />
</div>

<p align="center">
  <strong>Clinical Triage & Nursing Pre‑Assessment Platform</strong><br/>
  <em>Plataforma de Triagem Clínica e Pré‑Avaliação de Enfermagem</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Frontend-React%20(Vite)-0B5FA5?logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/Backend-NestJS-0B5FA5?logo=nestjs&logoColor=white" />
  <img src="https://img.shields.io/badge/ORM-Prisma-16B8A6?logo=prisma&logoColor=white" />
  <img src="https://img.shields.io/badge/Database-SQLite%20%7C%20PostgreSQL-16B8A6" />
  <img src="https://img.shields.io/badge/License-MIT-6B7280" />
  <img src="https://img.shields.io/badge/Status-Concept%20%2F%20Demo-6B7280" />
</p>

---

## Demo

![gif](https://github.com/user-attachments/assets/3c20ae26-e3ed-479e-b5ca-8fd31cc2677e)

---

<details open>
<summary><strong>🇬🇧 English</strong></summary>

<br/>

> ⚠️ **Disclaimer**
>
> WalkFlow is a **conceptual / demonstration project**.
> It is designed for **clinical triage modelling and nursing pre‑assessment workflows**.
>
> It must **not** be used with real identifiable patient data (PHI) without appropriate security review, regulatory compliance, and information governance.

---

## Overview

**WalkFlow** is a clinical operations support platform focused on **early clinical triage and nursing pre‑assessment** in **Walk‑in Clinics and unscheduled care settings**.

Designed from a **nursing and clinical‑operations perspective**, WalkFlow supports:

- Initial triage and prioritisation of walk‑in patients
- Structured nursing pre‑assessment before medical evaluation
- Waiting‑time visibility and queue management
- Safer patient routing and flow control
- Operational traceability, audit, and governance

WalkFlow does **not** replace clinical decision‑making systems.  
It supports **workflow organisation, risk stratification, and operational safety**.

---

## Intended Audience

- Nurses working in walk‑in clinics or urgent care
- Nurse coordinators and triage teams
- Clinical operations and patient‑flow managers
- Health IT and digital‑health professionals

---

## Core Capabilities

- **Nursing triage** – structured initial assessment and prioritisation
- **Pre‑assessment workflows** – standardised data capture before medical evaluation
- **Waiting‑time monitoring** – real‑time queue status and operational visibility
- **Risk flags & alerts** – early identification of potentially unstable patients
- **Role‑based access control (RBAC)** – Nurse / Coordinator / Administrator
- **Audit & traceability** – operational logs and activity history

---

## Architecture Overview

```
Frontend (React + Vite)
        ↓ REST API
Backend (NestJS)
        ↓ Prisma ORM
Database (SQLite / PostgreSQL)
```

---

## Technology Stack

- Frontend: React (Vite)
- Backend: NestJS
- ORM: Prisma
- Database: SQLite (default) / PostgreSQL (optional)

---

## Quick Start (Local Development)

```bash
chmod +x start.sh
./start.sh
```

### Environment configuration

```bash
cd server
cp env.example .env
```

Default values are suitable for local development.

> The `.env` file is intentionally excluded from version control.

---

## Security Notes (Minimum)

- Do not expose database ports publicly
- Use a strong `JWT_SECRET`
- Restrict CORS to authorised frontend domains
- Remove demo credentials in any real deployment
- Enforce RBAC server‑side
- Maintain audit logs for triage and status changes

---

## License

MIT License.  
Free to use, modify, and learn from.  
Not intended for production clinical use without appropriate validation.

</details>

---

<details>
<summary><strong>🇵🇹 Português (Portugal)</strong></summary>

<br/>

> ⚠️ **Aviso Importante**
>
> O WalkFlow é um **projeto conceptual / de demonstração**, orientado para a modelação de fluxos de triagem clínica e pré‑avaliação de enfermagem.
>
> **Não deve ser utilizado com dados reais identificáveis de utentes (PHI)** sem avaliação prévia de segurança, conformidade legal e adequada governação da informação.

---

## Visão Geral

O **WalkFlow** é uma plataforma de suporte à operação clínica, focada na **triagem inicial e pré‑avaliação de enfermagem** em **Walk‑in Clinics** e contextos de atendimento não programado.

Concebida a partir da **perspetiva da Enfermagem e das operações clínicas**, permite:

- Triagem estruturada do utente à entrada
- Priorização clínica inicial
- Pré‑avaliação de enfermagem antes da observação médica
- Monitorização de tempos de espera e listas de atendimento
- Melhoria do fluxo do utente e segurança assistencial

O WalkFlow **não substitui sistemas clínicos oficiais**, funcionando como uma camada de apoio operacional e organizacional.

---

## Destinatários

- Enfermeiros em contexto de atendimento não programado
- Enfermeiros coordenadores e equipas de triagem
- Gestores de fluxo de doentes e operações clínicas
- Profissionais de Sistemas de Informação em Saúde

---

## Funcionalidades Principais

- **Triagem de enfermagem** – avaliação inicial estruturada
- **Pré‑avaliação clínica** – recolha normalizada de dados relevantes
- **Gestão de tempos de espera** – visibilidade operacional em tempo real
- **Alertas de risco** – sinalização precoce de situações críticas
- **Controlo de acessos (RBAC)** – Enfermeiro / Coordenador / Administrador
- **Auditoria e rastreabilidade** – histórico de ações e estados

---

## Arranque Rápido (Desenvolvimento Local)

```bash
chmod +x start.sh
./start.sh
```

### Configuração de ambiente

```bash
cd server
cp env.example .env
```

Os valores por defeito são adequados para desenvolvimento local.

> O ficheiro `.env` encontra‑se intencionalmente excluído do controlo de versões.

---

## Licença

Licença MIT.  
Projeto educativo e conceptual.  
Não destinado a utilização clínica em produção sem validação adequada.

</details>

---

## Contact

- **Name:** Nuno da Silva Magalhães
- **Background:** Nursing & Clinical Operations
- **Email:** nsilvalsd@gmail.com
- **GitHub:** https://github.com/NunoSid
- **LinkedIn:** https://www.linkedin.com/in/nuno-da-silva-magalhães-421253199
