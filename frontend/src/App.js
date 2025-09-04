import React, { useState, useEffect, createContext, useContext } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import axios from "axios";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar } from 'recharts';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`, { withCredentials: true });
      setUser(response.data);
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await axios.post(`${API}/auth/logout`, {}, { withCredentials: true });
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, setUser, logout, loading, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

// Components
const Sidebar = ({ activeTab, setActiveTab, onLogout, isMobileOpen, setIsMobileOpen }) => {
  const menuItems = [
    { id: 'dashboard', name: 'Dashboard', icon: '📊' },
    { id: 'transactions', name: 'Transações', icon: '💳' },
    { id: 'categories', name: 'Categorias', icon: '🏷️' },
    { id: 'goals', name: 'Metas', icon: '🎯' },
    { id: 'reports', name: 'Relatórios', icon: '📈' }
  ];

  const handleItemClick = (itemId) => {
    setActiveTab(itemId);
    setIsMobileOpen(false); // Close mobile menu after selection
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <div className={`fixed left-0 top-0 h-full w-64 bg-gradient-to-b from-blue-900 to-blue-800 text-white shadow-xl z-50 transform transition-transform duration-300 ease-in-out ${
        isMobileOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0`}>
        <div className="p-4 lg:p-6">
          <div className="flex items-center justify-between mb-6 lg:mb-8">
            <h1 className="text-xl lg:text-2xl font-bold">💰 Financial Guardian</h1>
            <button
              onClick={() => setIsMobileOpen(false)}
              className="lg:hidden text-white hover:text-gray-300 p-1"
            >
              ✕
            </button>
          </div>
          <nav className="space-y-2">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                className={`w-full text-left px-3 lg:px-4 py-3 rounded-lg transition-colors duration-200 flex items-center space-x-3 ${
                  activeTab === item.id
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'hover:bg-blue-700 text-blue-100'
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="font-medium text-sm lg:text-base">{item.name}</span>
              </button>
            ))}
          </nav>
        </div>
        <div className="absolute bottom-4 lg:bottom-6 left-4 lg:left-6 right-4 lg:right-6">
          <button
            onClick={onLogout}
            className="w-full px-3 lg:px-4 py-3 bg-red-600 hover:bg-red-700 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2"
          >
            <span>🚪</span>
            <span className="text-sm lg:text-base">Sair</span>
          </button>
        </div>
      </div>
    </>
  );
};

const Dashboard = () => {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [goals, setGoals] = useState([]);
  const [monthlyReport, setMonthlyReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [txnRes, catRes, goalsRes] = await Promise.all([
        axios.get(`${API}/transactions`, { withCredentials: true }),
        axios.get(`${API}/categories`, { withCredentials: true }),
        axios.get(`${API}/goals`, { withCredentials: true })
      ]);

      setTransactions(txnRes.data);
      setCategories(catRes.data);
      setGoals(goalsRes.data);

      // Get current month report
      const now = new Date();
      const reportRes = await axios.get(
        `${API}/reports/monthly/${now.getFullYear()}/${now.getMonth() + 1}`,
        { withCredentials: true }
      );
      setMonthlyReport(reportRes.data);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const recentTransactions = transactions.slice(0, 5);
  const chartData = monthlyReport?.top_categories?.map(cat => ({
    name: cat.category,
    value: cat.amount,
    color: cat.color
  })) || [];

  const balanceData = [
    { name: 'Receitas', value: monthlyReport?.total_income || 0, color: '#22C55E' },
    { name: 'Despesas', value: monthlyReport?.total_expenses || 0, color: '#EF4444' }
  ];

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 text-white">
        <h2 className="text-2xl font-bold mb-2">Bem-vindo ao seu Financial Guardian!</h2>
        <p className="text-blue-100">Controle suas finanças de forma inteligente e segura</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6">
        <div className="bg-white rounded-xl p-4 lg:p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-xs lg:text-sm">Saldo do Mês</p>
              <p className={`text-lg lg:text-2xl font-bold ${(monthlyReport?.balance || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                R$ {(monthlyReport?.balance || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="text-2xl lg:text-3xl">💰</div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 lg:p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-xs lg:text-sm">Receitas</p>
              <p className="text-lg lg:text-2xl font-bold text-green-600">
                R$ {(monthlyReport?.total_income || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="text-2xl lg:text-3xl">📈</div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 lg:p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-xs lg:text-sm">Despesas</p>
              <p className="text-lg lg:text-2xl font-bold text-red-600">
                R$ {(monthlyReport?.total_expenses || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="text-2xl lg:text-3xl">📉</div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 lg:p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-xs lg:text-sm">Transações</p>
              <p className="text-lg lg:text-2xl font-bold text-blue-600">{monthlyReport?.transactions_count || 0}</p>
            </div>
            <div className="text-2xl lg:text-3xl">📋</div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white rounded-xl p-4 lg:p-6 shadow-lg border border-gray-100">
          <h3 className="text-lg font-semibold mb-4">Receitas vs Despesas</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={balanceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
              <Bar dataKey="value" fill="#3B82F6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl p-4 lg:p-6 shadow-lg border border-gray-100">
          <h3 className="text-lg font-semibold mb-4">Categorias de Despesa</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Transactions & Goals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
          <h3 className="text-lg font-semibold mb-4">Transações Recentes</h3>
          <div className="space-y-3">
            {recentTransactions.map((txn) => {
              const category = categories.find(c => c.id === txn.category_id);
              return (
                <div key={txn.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <span className="text-xl">{category?.icon || '💰'}</span>
                    <div>
                      <p className="font-medium">{txn.description}</p>
                      <p className="text-sm text-gray-600">{category?.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${txn.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                      {txn.type === 'income' ? '+' : '-'}R$ {txn.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-sm text-gray-600">
                      {new Date(txn.date).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
          <h3 className="text-lg font-semibold mb-4">Metas Financeiras</h3>
          <div className="space-y-4">
            {goals.slice(0, 3).map((goal) => {
              const progress = (goal.current_amount / goal.target_amount) * 100;
              return (
                <div key={goal.id} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-medium">{goal.name}</h4>
                    <span className="text-sm text-gray-600">{progress.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>R$ {goal.current_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    <span>R$ {goal.target_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

const TransactionsTab = () => {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [formData, setFormData] = useState({
    amount: '',
    type: 'expense',
    category_id: '',
    description: '',
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [txnRes, catRes] = await Promise.all([
        axios.get(`${API}/transactions`, { withCredentials: true }),
        axios.get(`${API}/categories`, { withCredentials: true })
      ]);
      setTransactions(txnRes.data);
      setCategories(catRes.data);
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const submitData = {
        ...formData,
        amount: parseFloat(formData.amount),
        date: new Date(formData.date).toISOString()
      };

      if (editingTransaction) {
        await axios.put(`${API}/transactions/${editingTransaction.id}`, submitData, { withCredentials: true });
      } else {
        await axios.post(`${API}/transactions`, submitData, { withCredentials: true });
      }

      setShowForm(false);
      setEditingTransaction(null);
      setFormData({
        amount: '',
        type: 'expense',
        category_id: '',
        description: '',
        date: new Date().toISOString().split('T')[0]
      });
      loadData();
    } catch (error) {
      console.error('Error saving transaction:', error);
    }
  };

  const handleEdit = (transaction) => {
    setEditingTransaction(transaction);
    setFormData({
      amount: transaction.amount.toString(),
      type: transaction.type,
      category_id: transaction.category_id,
      description: transaction.description,
      date: new Date(transaction.date).toISOString().split('T')[0]
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Tem certeza que deseja excluir esta transação?')) {
      try {
        await axios.delete(`${API}/transactions/${id}`, { withCredentials: true });
        loadData();
      } catch (error) {
        console.error('Error deleting transaction:', error);
      }
    }
  };

  const incomeCategories = categories.filter(c => ['Salário', 'Investimentos'].includes(c.name));
  const expenseCategories = categories.filter(c => !['Salário', 'Investimentos'].includes(c.name));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Transações</h2>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors duration-200 flex items-center space-x-2"
        >
          <span>+</span>
          <span>Nova Transação</span>
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-4 lg:p-6 w-full max-w-md mx-4 max-h-screen overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">
              {editingTransaction ? 'Editar Transação' : 'Nova Transação'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value, category_id: '' })}
                  className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                  required
                >
                  <option value="expense">Despesa</option>
                  <option value="income">Receita</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                  required
                >
                  <option value="">Selecione uma categoria</option>
                  {(formData.type === 'income' ? incomeCategories : expenseCategories).map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valor</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                  placeholder="0,00"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                  placeholder="Digite uma descrição"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                  required
                />
              </div>

              <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg transition-colors duration-200 font-medium"
                >
                  {editingTransaction ? 'Atualizar' : 'Criar'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingTransaction(null);
                    setFormData({
                      amount: '',
                      type: 'expense',
                      category_id: '',
                      description: '',
                      date: new Date().toISOString().split('T')[0]
                    });
                  }}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-3 rounded-lg transition-colors duration-200 font-medium"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">Histórico de Transações</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {transactions.map((txn) => {
            const category = categories.find(c => c.id === txn.category_id);
            return (
              <div key={txn.id} className="px-6 py-4 hover:bg-gray-50 transition-colors duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <span className="text-2xl">{category?.icon || '💰'}</span>
                    <div>
                      <p className="font-medium text-gray-900">{txn.description}</p>
                      <p className="text-sm text-gray-600">{category?.name}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(txn.date).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <p className={`font-semibold text-lg ${txn.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                        {txn.type === 'income' ? '+' : '-'}R$ {txn.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEdit(txn)}
                        className="text-blue-600 hover:text-blue-800 p-1"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDelete(txn.id)}
                        className="text-red-600 hover:text-red-800 p-1"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const CategoriesTab = () => {
  const [categories, setCategories] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    color: '#3B82F6',
    icon: '💰'
  });

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const response = await axios.get(`${API}/categories`, { withCredentials: true });
      setCategories(response.data);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/categories`, formData, { withCredentials: true });
      setShowForm(false);
      setFormData({ name: '', color: '#3B82F6', icon: '💰' });
      loadCategories();
    } catch (error) {
      console.error('Error creating category:', error);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Tem certeza que deseja excluir esta categoria?')) {
      try {
        await axios.delete(`${API}/categories/${id}`, { withCredentials: true });
        loadCategories();
      } catch (error) {
        console.error('Error deleting category:', error);
      }
    }
  };

  const commonIcons = ['💰', '🍽️', '🚗', '🏠', '⚕️', '📚', '🎬', '📈', '👕', '⚡', '📱', '🎁'];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Categorias</h2>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors duration-200 flex items-center space-x-2"
        >
          <span>+</span>
          <span>Nova Categoria</span>
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Nova Categoria</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Nome da categoria"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cor</label>
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-full h-12 rounded-lg border border-gray-300"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ícone</label>
                <div className="grid grid-cols-6 gap-2 mb-2">
                  {commonIcons.map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setFormData({ ...formData, icon })}
                      className={`p-2 text-xl border rounded-lg hover:bg-gray-100 ${
                        formData.icon === icon ? 'bg-blue-100 border-blue-500' : 'border-gray-300'
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ou digite um emoji"
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition-colors duration-200"
                >
                  Criar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setFormData({ name: '', color: '#3B82F6', icon: '💰' });
                  }}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 rounded-lg transition-colors duration-200"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.map((category) => (
          <div key={category.id} className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <span className="text-3xl">{category.icon}</span>
                <div>
                  <h3 className="font-semibold text-gray-900">{category.name}</h3>
                  <div className="flex items-center space-x-2">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: category.color }}
                    ></div>
                    <span className="text-sm text-gray-600">{category.color}</span>
                  </div>
                </div>
              </div>
              {!category.is_default && (
                <button
                  onClick={() => handleDelete(category.id)}
                  className="text-red-600 hover:text-red-800 p-1"
                >
                  🗑️
                </button>
              )}
            </div>
            {category.is_default && (
              <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                Padrão
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const GoalsTab = () => {
  const [goals, setGoals] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showAddAmount, setShowAddAmount] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    target_amount: '',
    deadline: ''
  });
  const [addAmountValue, setAddAmountValue] = useState('');

  useEffect(() => {
    loadGoals();
  }, []);

  const loadGoals = async () => {
    try {
      const response = await axios.get(`${API}/goals`, { withCredentials: true });
      setGoals(response.data);
    } catch (error) {
      console.error('Error loading goals:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const submitData = {
        ...formData,
        target_amount: parseFloat(formData.target_amount),
        deadline: formData.deadline ? new Date(formData.deadline).toISOString() : null
      };
      await axios.post(`${API}/goals`, submitData, { withCredentials: true });
      setShowForm(false);
      setFormData({ name: '', target_amount: '', deadline: '' });
      loadGoals();
    } catch (error) {
      console.error('Error creating goal:', error);
    }
  };

  const handleAddAmount = async (goalId) => {
    try {
      await axios.put(
        `${API}/goals/${goalId}/add-amount?amount=${parseFloat(addAmountValue)}`,
        {},
        { withCredentials: true }
      );
      setShowAddAmount(null);
      setAddAmountValue('');
      loadGoals();
    } catch (error) {
      console.error('Error adding amount to goal:', error);
    }
  };

  const handleDeleteGoal = async (id) => {
    if (window.confirm('Tem certeza que deseja excluir esta meta?')) {
      try {
        await axios.delete(`${API}/goals/${id}`, { withCredentials: true });
        loadGoals();
      } catch (error) {
        console.error('Error deleting goal:', error);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Metas Financeiras</h2>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors duration-200 flex items-center space-x-2"
        >
          <span>+</span>
          <span>Nova Meta</span>
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Nova Meta</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Meta</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: Reserva de emergência"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valor Alvo</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.target_amount}
                  onChange={(e) => setFormData({ ...formData, target_amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0,00"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prazo (opcional)</label>
                <input
                  type="date"
                  value={formData.deadline}
                  onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition-colors duration-200"
                >
                  Criar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setFormData({ name: '', target_amount: '', deadline: '' });
                  }}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 rounded-lg transition-colors duration-200"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddAmount && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Adicionar Valor</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valor</label>
                <input
                  type="number"
                  step="0.01"
                  value={addAmountValue}
                  onChange={(e) => setAddAmountValue(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0,00"
                  required
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => handleAddAmount(showAddAmount)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition-colors duration-200"
                >
                  Adicionar
                </button>
                <button
                  onClick={() => {
                    setShowAddAmount(null);
                    setAddAmountValue('');
                  }}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 rounded-lg transition-colors duration-200"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {goals.map((goal) => {
          const progress = (goal.current_amount / goal.target_amount) * 100;
          const isCompleted = goal.status === 'completed';
          
          return (
            <div key={goal.id} className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-semibold text-gray-900">{goal.name}</h3>
                <div className="flex space-x-2">
                  {!isCompleted && (
                    <button
                      onClick={() => setShowAddAmount(goal.id)}
                      className="text-blue-600 hover:text-blue-800 p-1"
                      title="Adicionar valor"
                    >
                      ➕
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteGoal(goal.id)}
                    className="text-red-600 hover:text-red-800 p-1"
                    title="Excluir meta"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">Progresso</span>
                  <span className={`text-sm font-medium ${isCompleted ? 'text-green-600' : 'text-blue-600'}`}>
                    {progress.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all duration-300 ${
                      isCompleted ? 'bg-green-500' : 'bg-blue-600'
                    }`}
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  ></div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Atual:</span>
                  <span className="font-medium">
                    R$ {goal.current_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Meta:</span>
                  <span className="font-medium">
                    R$ {goal.target_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {goal.deadline && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Prazo:</span>
                    <span className="font-medium">
                      {new Date(goal.deadline).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Status:</span>
                  <span className={`font-medium ${
                    isCompleted ? 'text-green-600' : 'text-blue-600'
                  }`}>
                    {isCompleted ? '✅ Concluída' : '🎯 Em andamento'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ReportsTab = () => {
  const [monthlyReport, setMonthlyReport] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadReport();
  }, [selectedMonth, selectedYear]);

  const loadReport = async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        `${API}/reports/monthly/${selectedYear}/${selectedMonth}`,
        { withCredentials: true }
      );
      setMonthlyReport(response.data);
    } catch (error) {
      console.error('Error loading report:', error);
    } finally {
      setLoading(false);
    }
  };

  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const chartData = monthlyReport?.top_categories?.map(cat => ({
    name: cat.category,
    value: cat.amount,
    color: cat.color
  })) || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Relatórios</h2>
        <div className="flex space-x-4">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {months.map((month, index) => (
              <option key={index} value={index + 1}>
                {month}
              </option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {[2024, 2025, 2026].map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </div>

      {monthlyReport && (
        <>
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 text-white">
            <h3 className="text-xl font-bold mb-4">
              Relatório de {months[selectedMonth - 1]} {selectedYear}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-blue-100 text-sm">Receitas</p>
                <p className="text-2xl font-bold">
                  R$ {monthlyReport.total_income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="text-center">
                <p className="text-blue-100 text-sm">Despesas</p>
                <p className="text-2xl font-bold">
                  R$ {monthlyReport.total_expenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="text-center">
                <p className="text-blue-100 text-sm">Saldo</p>
                <p className={`text-2xl font-bold ${monthlyReport.balance >= 0 ? 'text-green-200' : 'text-red-200'}`}>
                  R$ {monthlyReport.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="text-center">
                <p className="text-blue-100 text-sm">Transações</p>
                <p className="text-2xl font-bold">{monthlyReport.transactions_count}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
              <h3 className="text-lg font-semibold mb-4">Categorias com Maior Gasto</h3>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={120}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-64 text-gray-500">
                  Nenhum dado de despesa encontrado
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
              <h3 className="text-lg font-semibold mb-4">Resumo de Gastos</h3>
              <div className="space-y-4">
                {monthlyReport.top_categories.map((category, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: category.color }}
                      ></div>
                      <span className="font-medium">{category.category}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-red-600">
                        R$ {category.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-sm text-gray-600">
                        {((category.amount / monthlyReport.total_expenses) * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// Auth Pages
const LoginPage = () => {
  const { checkAuth } = useAuth();
  const location = useLocation();

  useEffect(() => {
    // Check for session_id in URL fragment
    if (location.hash.includes('session_id=')) {
      const sessionId = location.hash.split('session_id=')[1];
      handleAuthCallback(sessionId);
    }
  }, [location]);

  const handleAuthCallback = async (sessionId) => {
    try {
      const response = await axios.post(
        `${API}/auth/callback?session_id=${sessionId}`,
        {},
        { withCredentials: true }
      );
      if (response.data.success) {
        checkAuth();
      }
    } catch (error) {
      console.error('Auth callback error:', error);
    }
  };

  const handleLogin = () => {
    const currentUrl = window.location.origin;
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(currentUrl + '/profile')}`;
    window.location.href = '/dashboard'; // Exemplo de redirecionamento
    // TODO: Implementar sistema de autenticação próprio ou usar outro provedor
    // const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(currentUrl + '/profile')}`;
    // window.location.href = authUrl;
    //alert('Sistema de autenticação em desenvolvimento');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-600 to-purple-700 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
          <div className="mb-8">
            <img
              src="https://images.unsplash.com/photo-1596784326488-23581279e33d"
              alt="Financial Management"
              className="w-24 h-24 rounded-full mx-auto mb-4 object-cover shadow-lg"
            />
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Financial Guardian</h1>
            <p className="text-gray-600">Controle suas finanças de forma inteligente e segura</p>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl mb-2">📊</div>
                <p className="text-sm text-gray-600">Dashboard Inteligente</p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <div className="text-2xl mb-2">🎯</div>
                <p className="text-sm text-gray-600">Metas Financeiras</p>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl mb-2">📈</div>
                <p className="text-sm text-gray-600">Relatórios Detalhados</p>
              </div>
            </div>

            <button
              onClick={handleLogin}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-6 rounded-xl transition-colors duration-200 flex items-center justify-center space-x-3 shadow-lg hover:shadow-xl"
            >
              <span className="text-xl">🔐</span>
              <span>Entrar com Google</span>
            </button>

            <p className="text-xs text-gray-500 mt-4">
              Autenticação segura e protegida. Seus dados financeiros são criptografados e mantidos seguros.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const ProfilePage = () => {
  const { checkAuth } = useAuth();
  const location = useLocation();

  useEffect(() => {
    // Handle auth callback on profile page
    if (location.hash.includes('session_id=')) {
      const sessionId = location.hash.split('session_id=')[1];
      handleAuthCallback(sessionId);
    }
  }, [location]);

  const handleAuthCallback = async (sessionId) => {
    try {
      const response = await axios.post(
        `${API}/auth/callback?session_id=${sessionId}`,
        {},
        { withCredentials: true }
      );
      if (response.data.success) {
        checkAuth();
      }
    } catch (error) {
      console.error('Auth callback error:', error);
    }
  };

  return <Navigate to="/" replace />;
};

const Dashboard_Main = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'transactions':
        return <TransactionsTab />;
      case 'categories':
        return <CategoriesTab />;
      case 'goals':
        return <GoalsTab />;
      case 'reports':
        return <ReportsTab />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onLogout={logout}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
      />
      
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-white shadow-md z-30 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setIsMobileOpen(true)}
          className="p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          ☰
        </button>
        <h1 className="font-bold text-gray-800">Financial Guardian</h1>
        {user?.picture && (
          <img
            src={user.picture}
            alt={user.name}
            className="w-8 h-8 rounded-full"
          />
        )}
      </div>

      <div className="lg:ml-64 pt-16 lg:pt-0 p-4 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-4 lg:mb-6 hidden lg:block">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-gray-800">
                  Olá, {user?.name?.split(' ')[0]}! 👋
                </h1>
                <p className="text-gray-600 text-sm lg:text-base">Bem-vindo de volta ao seu painel financeiro</p>
              </div>
              <div className="flex items-center space-x-4">
                {user?.picture && (
                  <img
                    src={user.picture}
                    alt={user.name}
                    className="w-10 h-10 rounded-full"
                  />
                )}
                <div className="text-right hidden lg:block">
                  <p className="font-medium text-gray-800">{user?.name}</p>
                  <p className="text-sm text-gray-600">{user?.email}</p>
                </div>
              </div>
            </div>
          </div>
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 to-purple-700">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-xl">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/profile" element={<ProfilePage />} />
          <Route
            path="/"
            element={user ? <Dashboard_Main /> : <LoginPage />}
          />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

function AppWithProvider() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}

export default AppWithProvider;