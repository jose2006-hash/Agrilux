import React from 'react';
import { CreditCard, Lock } from 'lucide-react';

export default function SaludFinanciera() {
  return (
    <div className="min-h-screen pb-24">
      <div className="bg-amber-500 text-white px-6 pt-12 pb-6">
        <h1 className="text-2xl font-display font-bold">Salud Financiera</h1>
        <p className="text-white/70 text-sm mt-1">Micro-Crédito Disponible</p>
      </div>

      <div className="px-4 py-6 space-y-4">
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <CreditCard size={24} className="text-amber-500" />
              <div>
                <p className="font-bold text-gray-800">Crédito Disponible</p>
                <p className="text-xs text-gray-400">Micro-Crédito Agrilux</p>
              </div>
            </div>
            <span className="bg-amber-100 text-amber-600 text-xs font-bold px-3 py-1 rounded-full">PRÓXIMAMENTE</span>
          </div>

          <div className="mb-6">
            <p className="text-xs text-gray-400">Crédito disponible</p>
            <p className="text-4xl font-display font-bold text-gray-800">S/ 0.00</p>
            <p className="text-xs text-gray-400 mt-1">Usado: S/ 0.00 (0%)</p>
          </div>

          <div className="bg-gray-100 rounded-xl p-4 mb-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-amber-400 h-2 rounded-full w-0"></div>
            </div>
          </div>

          <button disabled className="w-full bg-gray-200 text-gray-400 font-bold py-4 rounded-xl flex items-center justify-center gap-2 cursor-not-allowed">
            <Lock size={18} /> Solicitar Micro-préstamo
          </button>

          <p className="text-center text-xs text-gray-400 mt-4">
            Estamos trabajando con aliados financieros para habilitar esta opción pronto
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="font-bold text-amber-700 mb-2">¿Qué podrás hacer próximamente?</p>
          <ul className="space-y-2 text-sm text-amber-600">
            {['Solicitar micro-créditos para tu campaña agrícola', 'Pagar en cuotas según tu cosecha', 'Historial crediticio basado en tus ventas', 'Tasas preferenciales para agricultores registrados'].map(i => (
              <li key={i} className="flex items-start gap-2"><span>✓</span>{i}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
