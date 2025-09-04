from fastapi import FastAPI, APIRouter, HTTPException, Depends, Response, Cookie
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
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

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

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
def prepare_for_mongo(data):
    """Prepare data for MongoDB storage"""
    if isinstance(data, dict):
        for key, value in data.items():
            if isinstance(value, datetime):
                data[key] = value.isoformat()
    return data

def parse_from_mongo(item):
    """Parse data from MongoDB"""
    if isinstance(item, dict):
        for key, value in item.items():
            if key.endswith('_at') or key == 'date' or key == 'deadline':
                if isinstance(value, str):
                    try:
                        item[key] = datetime.fromisoformat(value.replace('Z', '+00:00'))
                    except:
                        pass
    return item

# Authentication functions
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), session_token: str = Cookie(None)):
    token = None
    if session_token:
        token = session_token
    elif credentials:
        token = credentials.credentials
    
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Find session in database
    session = await db.sessions.find_one({"session_token": token})
    if not session or datetime.fromisoformat(session['expires_at']) < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    
    # Get user
    user = await db.users.find_one({"id": session['user_id']})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return User(**parse_from_mongo(user))

# Routes

# Health Check
@api_router.get("/")
async def health_check():
    return {"message": "Financial Guardian API is running", "status": "healthy"}

# Authentication
@api_router.post("/auth/callback")
async def auth_callback(session_id: str, response: Response):
    try:
        # Call Emergent auth API
        async with httpx.AsyncClient() as client:
            auth_response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id}
            )
            auth_response.raise_for_status()
            auth_data = auth_response.json()
        
        # Check if user exists
        existing_user = await db.users.find_one({"email": auth_data["email"]})
        
        if not existing_user:
            # Create new user
            user_data = {
                "id": str(uuid.uuid4()),
                "email": auth_data["email"],
                "name": auth_data["name"],
                "picture": auth_data.get("picture"),
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.users.insert_one(user_data)
            
            # Create default categories
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
                category = {
                    "id": str(uuid.uuid4()),
                    "user_id": user_data["id"],
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    **cat_data
                }
                await db.categories.insert_one(category)
        else:
            user_data = existing_user
        
        # Create session
        session_data = {
            "id": str(uuid.uuid4()),
            "user_id": user_data["id"],
            "session_token": auth_data["session_token"],
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.sessions.insert_one(session_data)
        
        # Set cookie
        response.set_cookie(
            key="session_token",
            value=auth_data["session_token"],
            max_age=7 * 24 * 60 * 60,  # 7 days
            httponly=True,
            secure=True,
            samesite="none",
            path="/"
        )
        
        return {"success": True, "user": User(**parse_from_mongo(user_data))}
        
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=400, detail=f"Auth failed: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@api_router.post("/auth/logout")
async def logout(response: Response, session_token: str = Cookie(None)):
    if session_token:
        await db.sessions.delete_many({"session_token": session_token})
    response.delete_cookie(key="session_token", path="/")
    return {"success": True}

# Categories
@api_router.get("/categories", response_model=List[Category])
async def get_categories(current_user: User = Depends(get_current_user)):
    categories = await db.categories.find({"user_id": current_user.id}).to_list(1000)
    return [Category(**parse_from_mongo(cat)) for cat in categories]

@api_router.post("/categories", response_model=Category)
async def create_category(category_data: CategoryCreate, current_user: User = Depends(get_current_user)):
    category_dict = category_data.dict()
    category_dict["user_id"] = current_user.id
    category_obj = Category(**category_dict)
    category_mongo = prepare_for_mongo(category_obj.dict())
    await db.categories.insert_one(category_mongo)
    return category_obj

@api_router.delete("/categories/{category_id}")
async def delete_category(category_id: str, current_user: User = Depends(get_current_user)):
    result = await db.categories.delete_one({"id": category_id, "user_id": current_user.id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"success": True}

# Transactions
@api_router.get("/transactions", response_model=List[Transaction])
async def get_transactions(current_user: User = Depends(get_current_user)):
    transactions = await db.transactions.find({"user_id": current_user.id}).sort("date", -1).to_list(1000)
    return [Transaction(**parse_from_mongo(txn)) for txn in transactions]

@api_router.post("/transactions", response_model=Transaction)
async def create_transaction(transaction_data: TransactionCreate, current_user: User = Depends(get_current_user)):
    transaction_dict = transaction_data.dict()
    transaction_dict["user_id"] = current_user.id
    transaction_obj = Transaction(**transaction_dict)
    transaction_mongo = prepare_for_mongo(transaction_obj.dict())
    await db.transactions.insert_one(transaction_mongo)
    return transaction_obj

@api_router.put("/transactions/{transaction_id}", response_model=Transaction)
async def update_transaction(transaction_id: str, transaction_data: TransactionCreate, current_user: User = Depends(get_current_user)):
    transaction_dict = transaction_data.dict()
    transaction_dict["user_id"] = current_user.id
    transaction_mongo = prepare_for_mongo(transaction_dict)
    
    result = await db.transactions.update_one(
        {"id": transaction_id, "user_id": current_user.id},
        {"$set": transaction_mongo}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    updated_transaction = await db.transactions.find_one({"id": transaction_id})
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
    goals = await db.goals.find({"user_id": current_user.id}).to_list(1000)
    return [Goal(**parse_from_mongo(goal)) for goal in goals]

@api_router.post("/goals", response_model=Goal)
async def create_goal(goal_data: GoalCreate, current_user: User = Depends(get_current_user)):
    goal_dict = goal_data.dict()
    goal_dict["user_id"] = current_user.id
    goal_obj = Goal(**goal_dict)
    goal_mongo = prepare_for_mongo(goal_obj.dict())
    await db.goals.insert_one(goal_mongo)
    return goal_obj

@api_router.put("/goals/{goal_id}/add-amount")
async def add_to_goal(goal_id: str, amount: float, current_user: User = Depends(get_current_user)):
    goal = await db.goals.find_one({"id": goal_id, "user_id": current_user.id})
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    new_amount = goal.get("current_amount", 0) + amount
    status = GoalStatus.COMPLETED if new_amount >= goal["target_amount"] else GoalStatus.ACTIVE
    
    await db.goals.update_one(
        {"id": goal_id, "user_id": current_user.id},
        {"$set": {"current_amount": new_amount, "status": status}}
    )
    
    updated_goal = await db.goals.find_one({"id": goal_id})
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
    # Date range for the month
    start_date = datetime(year, month, 1)
    if month == 12:
        end_date = datetime(year + 1, 1, 1)
    else:
        end_date = datetime(year, month + 1, 1)
    
    # Get transactions for the month
    transactions = await db.transactions.find({
        "user_id": current_user.id,
        "date": {
            "$gte": start_date.isoformat(),
            "$lt": end_date.isoformat()
        }
    }).to_list(1000)
    
    # Calculate totals
    total_income = sum(t["amount"] for t in transactions if t["type"] == "income")
    total_expenses = sum(t["amount"] for t in transactions if t["type"] == "expense")
    
    # Get categories
    categories = await db.categories.find({"user_id": current_user.id}).to_list(1000)
    cat_dict = {cat["id"]: cat for cat in categories}
    
    # Top categories
    category_totals = {}
    for txn in transactions:
        if txn["type"] == "expense":
            cat_id = txn["category_id"]
            if cat_id in category_totals:
                category_totals[cat_id] += txn["amount"]
            else:
                category_totals[cat_id] = txn["amount"]
    
    top_categories = []
    for cat_id, amount in sorted(category_totals.items(), key=lambda x: x[1], reverse=True)[:5]:
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

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()