from fastapi import FastAPI, APRouter, HTTPException, Depends, Response, Cookie, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import RedirectResponse
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import httpx
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from enum import Enum
import urllib.parse

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
# Use .get() for safer access to environment variables
mongo_url = os.environ.get('MONGO_URL')
db_name = os.environ.get('DB_NAME')
if not mongo_url or not db_name:
    raise RuntimeError("MONGO_URL and DB_NAME environment variables are required.")

client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer(auto_error=False)

# Enums
class TransactionType(str, Enum):
    INCOME = "income"
    EXPENSE = "expense"

class GoalStatus(str, Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    PAUSED = "paused"

# Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    picture: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ... (Todos os seus outros modelos Pydantic continuam aqui, sem alterações)
class UserCreate(BaseModel):
    email: str
    name: str
    picture: Optional[str] = None

class Session(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Category(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    color: str = "#3B82F6"
    icon: str = "💰"
    is_default: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CategoryCreate(BaseModel):
    name: str
    color: str = "#3B82F6"
    icon: str = "💰"

class Transaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    amount: float
    type: TransactionType
    category_id: str
    description: str
    date: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TransactionCreate(BaseModel):
    amount: float
    type: TransactionType
    category_id: str
    description: str
    date: datetime

class Goal(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    target_amount: float
    current_amount: float = 0.0
    deadline: Optional[datetime] = None
    status: GoalStatus = GoalStatus.ACTIVE
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class GoalCreate(BaseModel):
    name: str
    target_amount: float
    deadline: Optional[datetime] = None

class MonthlyReport(BaseModel):
    month: str
    year: int
    total_income: float
    total_expenses: float
    balance: float
    transactions_count: int
    top_categories: List[dict]


# Helper functions
def parse_from_mongo(item):
    """Parse data from MongoDB"""
    if isinstance(item, dict):
        for key, value in item.items():
            if key.endswith('_at') or key == 'date' or key == 'deadline':
                if isinstance(value, str):
                    try:
                        # Handle both Z and +00:00 formats
                        item[key] = datetime.fromisoformat(value.replace('Z', '+00:00'))
                    except ValueError:
                        pass # Ignore if format is incorrect
    return item

# Authentication functions
async def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security), session_token: Optional[str] = Cookie(None)):
    token = None
    if session_token:
        token = session_token
    elif credentials:
        token = credentials.credentials
    
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session = await db.sessions.find_one({"session_token": token})
    
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session token")

    # It's better to parse the datetime object for comparison
    expires_at = parse_from_mongo(session).get('expires_at')
    if not expires_at or expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    user = await db.users.find_one({"id": session['user_id']})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return User(**parse_from_mongo(user))

# Routes

# Health Check
@api_router.get("/")
async def health_check():
    return {"message": "Financial Guardian API is running", "status": "healthy"}

# --- INÍCIO DAS MUDANÇAS NA AUTENTICAÇÃO ---

@api_router.get("/auth/login")
async def auth_login(redirect_uri: str = Query(...)):
    """
    Inicia o fluxo de autenticação.
    Redireciona o usuário para o serviço de autenticação externo.
    """
    # A URL do nosso próprio backend que irá receber o callback
    # É importante usar a variável de ambiente para a URL do Render
    backend_url = os.environ.get("RENDER_EXTERNAL_URL")
    if not backend_url:
        raise HTTPException(status_code=500, detail="RENDER_EXTERNAL_URL is not set")
    backend_callback_url = f"{backend_url}/api/auth/callback;"

    # O Emergent Agent precisa saber para onde redirecionar (nosso callback)
    # E nós precisamos saber para onde redirecionar o usuário no final (o frontend)
    redirect_param = f"{backend_callback_url}?final_redirect={urllib.parse.quote(redirect_uri)}"
    
    auth_service_url = f"https://auth.emergentagent.com/?redirect={urllib.parse.quote(redirect_param)}"
    
    return RedirectResponse(url=auth_service_url)


@api_router.get("/auth/callback") # MUDANÇA: Era POST, agora é GET para receber o redirect
async def auth_callback(session_id: str, response: Response, final_redirect: Optional[str] = Query(None)):
    """
    Recebe o callback do serviço de autenticação, cria o usuário/sessão
    e redireciona de volta para o frontend.
    """
    try:
        # Chama a API do Emergent para validar o session_id e obter os dados do usuário
        async with httpx.AsyncClient() as client:
            auth_response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id}
            )
            auth_response.raise_for_status()
            auth_data = auth_response.json()
        
        # Verifica se o usuário já existe
        user = await db.users.find_one({"email": auth_data["email"]})
        
        if not user:
            # Cria um novo usuário se não existir
            new_user = User(
                email=auth_data["email"],
                name=auth_data["name"],
                picture=auth_data.get("picture")
            )
            await db.users.insert_one(new_user.dict())
            user_id = new_user.id
            
            # Cria categorias padrão para o novo usuário
            default_categories = [
                {"name": "Alimentação", "color": "#EF4444", "icon": "🍽️", "is_default": True},
                {"name": "Transporte", "color": "#3B82F6", "icon": "🚗", "is_default": True},
                {"name": "Moradia", "color": "#8B5CF6", "icon": "🏠", "is_default": True},
                {"name": "Saúde", "color": "#10B981", "icon": "⚕️", "is_default": True},
                {"name": "Educação", "color": "#F59E0B", "icon": "📚", "is_default": True},
                {"name": "Entretenimento", "color": "#EC4899", "icon": "🎬", "is_default": True},
                {"name": "Salário", "color": "#22C55E", "icon": "💰", "is_default": True},
                {"name": "Investimentos", "color": "#6366F1", "icon": "📈", "is_default": True}
            ]
            for cat_data in default_categories:
                category = Category(user_id=user_id, **cat_data)
                await db.categories.insert_one(category.dict())
        else:
            user_id = user["id"]
        
        # Cria uma nova sessão para o usuário
        session_token = auth_data.get("session_token", str(uuid.uuid4())) # Gera um token se não vier
        new_session = Session(
            user_id=user_id,
            session_token=session_token,
            expires_at=datetime.now(timezone.utc) + timedelta(days=7)
        )
        await db.sessions.insert_one(new_session.dict())
        
        # Define o cookie no navegador do usuário
        response.set_cookie(
            key="session_token",
            value=session_token,
            max_age=7 * 24 * 60 * 60,  # 7 dias
            httponly=True,
            secure=True,
            samesite="none",
            path="/"
        )
        
        # Se tivermos a URL final, redireciona para lá
        if final_redirect:
            return RedirectResponse(url=final_redirect)
        
        return {"success": True, "message": "Login successful, but no redirect URL provided."}
        
    except httpx.HTTPStatusError as e:
        error_detail = e.response.json().get("detail", str(e))
        raise HTTPException(status_code=400, detail=f"Auth failed: {error_detail}")
    except Exception as e:
        logging.error(f"Internal error during auth callback: {e}")
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")

# --- FIM DAS MUDANÇAS NA AUTENTICAÇÃO ---

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@api_router.post("/auth/logout")
async def logout(response: Response, session_token: Optional[str] = Cookie(None)):
    if session_token:
        await db.sessions.delete_many({"session_token": session_token})
    response.delete_cookie(key="session_token", path="/")
    return {"success": True}

# ... (Todas as suas outras rotas para categories, transactions, goals, etc. continuam aqui)
# Categories
@api_router.get("/categories", response_model=List[Category])
async def get_categories(current_user: User = Depends(get_current_user)):
    categories_cursor = db.categories.find({"user_id": current_user.id})
    categories = await categories_cursor.to_list(1000)
    return [Category(**parse_from_mongo(cat)) for cat in categories]

@api_router.post("/categories", response_model=Category)
async def create_category(category_data: CategoryCreate, current_user: User = Depends(get_current_user)):
    category = Category(user_id=current_user.id, **category_data.dict())
    await db.categories.insert_one(category.dict())
    return category

@api_router.delete("/categories/{category_id}")
async def delete_category(category_id: str, current_user: User = Depends(get_current_user)):
    result = await db.categories.delete_one({"id": category_id, "user_id": current_user.id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"success": True}

# Transactions
@api_router.get("/transactions", response_model=List[Transaction])
async def get_transactions(current_user: User = Depends(get_current_user)):
    transactions_cursor = db.transactions.find({"user_id": current_user.id}).sort("date", -1)
    transactions = await transactions_cursor.to_list(1000)
    return [Transaction(**parse_from_mongo(txn)) for txn in transactions]

@api_router.post("/transactions", response_model=Transaction)
async def create_transaction(transaction_data: TransactionCreate, current_user: User = Depends(get_current_user)):
    transaction = Transaction(user_id=current_user.id, **transaction_data.dict())
    await db.transactions.insert_one(transaction.dict())
    return transaction

@api_router.put("/transactions/{transaction_id}", response_model=Transaction)
async def update_transaction(transaction_id: str, transaction_data: TransactionCreate, current_user: User = Depends(get_current_user)):
    result = await db.transactions.update_one(
        {"id": transaction_id, "user_id": current_user.id},
        {"$set": transaction_data.dict()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    updated_transaction = await db.transactions.find_one({"id": transaction_id, "user_id": current_user.id})
    return Transaction(**parse_from_mongo(updated_transaction))

@api_router.delete("/transactions/{transaction_id}")
async def delete_transaction(transaction_id: str, current_user: User = Depends(get_current_user)):
    result = await db.transactions.delete_one({"id": transaction_id, "user_id": current_user.id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return {"success": True}

# Goals
@api_router.get("/goals", response_model=List[Goal])
async def get_goals(current_user: User = Depends(get_current_user)):
    goals_cursor = db.goals.find({"user_id": current_user.id})
    goals = await goals_cursor.to_list(1000)
    return [Goal(**parse_from_mongo(goal)) for goal in goals]

@api_router.post("/goals", response_model=Goal)
async def create_goal(goal_data: GoalCreate, current_user: User = Depends(get_current_user)):
    goal = Goal(user_id=current_user.id, **goal_data.dict())
    await db.goals.insert_one(goal.dict())
    return goal

@api_router.put("/goals/{goal_id}/add-amount", response_model=Goal)
async def add_to_goal(goal_id: str, amount: float = Query(..., gt=0), current_user: User = Depends(get_current_user)):
    goal = await db.goals.find_one({"id": goal_id, "user_id": current_user.id})
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    new_amount = goal.get("current_amount", 0) + amount
    status = GoalStatus.COMPLETED if new_amount >= goal["target_amount"] else goal["status"]
    
    await db.goals.update_one(
        {"id": goal_id, "user_id": current_user.id},
        {"$set": {"current_amount": new_amount, "status": status}}
    )
    
    updated_goal = await db.goals.find_one({"id": goal_id, "user_id": current_user.id})
    return Goal(**parse_from_mongo(updated_goal))

@api_router.delete("/goals/{goal_id}")
async def delete_goal(goal_id: str, current_user: User = Depends(get_current_user)):
    result = await db.goals.delete_one({"id": goal_id, "user_id": current_user.id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Goal not found")
    return {"success": True}

# Reports
@api_router.get("/reports/monthly/{year}/{month}", response_model=MonthlyReport)
async def get_monthly_report(year: int, month: int, current_user: User = Depends(get_current_user)):
    start_date = datetime(year, month, 1, tzinfo=timezone.utc)
    if month == 12:
        end_date = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        end_date = datetime(year, month + 1, 1, tzinfo=timezone.utc)
    
    transactions_cursor = db.transactions.find({
        "user_id": current_user.id,
        "date": {"$gte": start_date, "$lt": end_date}
    })
    transactions = await transactions_cursor.to_list(1000)
    
    total_income = sum(t["amount"] for t in transactions if t["type"] == TransactionType.INCOME)
    total_expenses = sum(t["amount"] for t in transactions if t["type"] == TransactionType.EXPENSE)
    
    categories_cursor = db.categories.find({"user_id": current_user.id})
    categories = await categories_cursor.to_list(1000)
    cat_dict = {cat["id"]: cat for cat in categories}
    
    category_totals = {}
    for txn in transactions:
        if txn["type"] == TransactionType.EXPENSE:
            cat_id = txn["category_id"]
            category_totals[cat_id] = category_totals.get(cat_id, 0) + txn["amount"]
    
    top_categories_sorted = sorted(category_totals.items(), key=lambda item: item[1], reverse=True)[:5]
    
    top_categories = []
    for cat_id, amount in top_categories_sorted:
        if cat_id in cat_dict:
            top_categories.append({
                "category": cat_dict[cat_id]["name"],
                "amount": amount,
                "color": cat_dict[cat_id]["color"]
            })
    
    return MonthlyReport(
        month=f"{month:02d}",
        year=year,
        total_income=total_income,
        total_expenses=total_expenses,
        balance=total_income - total_expenses,
        transactions_count=len(transactions),
        top_categories=top_categories
    )

# Include the router in the main app
app.include_router(api_router)

# CORS Middleware Configuration
origins = [
    "https://financas-eight-alpha.vercel.app",
    # Você pode adicionar a URL de desenvolvimento local aqui também
    # "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

@app.on_event("startup")
async def startup_event():
    logging.info("Application startup")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
    logging.info("MongoDB connection closed")