import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Layout/Navbar'
import Dashboard from './pages/Dashboard'
import Inventory from './pages/Inventory'
import Scan from './pages/Scan'
import Add from './pages/Add'
import Login from './pages/Login'
import ShoppingList from './pages/ShoppingList'

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 pt-4">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/scan" element={<Scan />} />
          <Route path="/add" element={<Add />} />
          <Route path="/shopping-list" element={<ShoppingList />} />
          <Route path="/login" element={<Login />} />
        </Routes>
      </main>
    </div>
  )
}
