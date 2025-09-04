# Financial Guardian App

Aplicação full-stack para gestão financeira pessoal com FastAPI (backend) e React CRA (frontend).

## Requisitos
- Python 3.11+
- Node.js 18+ e Yarn 1.x
- MongoDB 6+ (local ou remoto)

## Estrutura
- `backend/`: API FastAPI com MongoDB
- `frontend/`: SPA React (Create React App + Tailwind)

## Configuração
1) Copie os arquivos de exemplo `.env`:
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```
2) Ajuste variáveis conforme seu ambiente:
- backend/.env
  - `MONGO_URL=mongodb://localhost:27017`
  - `DB_NAME=financial_guardian`
  - `CORS_ORIGINS=http://localhost:3000`
- frontend/.env
  - `REACT_APP_BACKEND_URL=http://localhost:8000`

## Executando localmente
- Backend:
```bash
cd backend
python -m venv .venv && .venv\Scripts\activate  # Windows PowerShell
pip install -r requirements.txt
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```
- Frontend:
```bash
cd frontend
yarn
yarn start
```

Acesse o frontend em `http://localhost:3000`. A API estará em `http://localhost:8000/api`.

## Testes
- Backend (pytest):
```bash
cd backend
pytest -q
```

## Notas de Autenticação
- O backend possui um sistema de autenticação em desenvolvimento.
- Para desenvolvimento, considere adicionar uma rota de "dev login" que crie um usuário e sessão locais.

## Scripts úteis
- `frontend`: `yarn build`, `yarn test`
- `backend`: formatação/lint sugeridos `black`, `isort`, `flake8`, `mypy`

## Próximos Passos
- Docker Compose com MongoDB, API e Frontend
- Refatorar chamadas de API no frontend para `services/`
- Testes de integração básicos no backend
- CI com GitHub Actions para lint e testes
