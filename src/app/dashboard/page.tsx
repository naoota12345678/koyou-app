"use client";

import AuthGuard from "@/components/AuthGuard";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}

function DashboardContent() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900">ダッシュボード</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.email}</span>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              ログアウト
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* 在籍サマリー */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-500">管理部署数</p>
            <p className="text-2xl font-bold">-</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-500">在職中</p>
            <p className="text-2xl font-bold">-</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-500">社保加入</p>
            <p className="text-2xl font-bold">-</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-500">雇用保険</p>
            <p className="text-2xl font-bold">-</p>
          </div>
        </div>

        {/* 会社一覧（後で実装） */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold">管理部署一覧</h2>
            <button className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">
              + 部署を追加
            </button>
          </div>
          <p className="text-gray-500 text-sm">部署が登録されていません</p>
        </div>
      </main>
    </div>
  );
}
