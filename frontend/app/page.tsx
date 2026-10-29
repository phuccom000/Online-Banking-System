import React, { useState } from 'react';
import {
  useReadContract,
  useWriteContract,
  useAccount,
  useWaitForTransactionReceipt
} from 'wagmi';
import {
  TrendingUp,
  Wallet,
  PlusCircle,
  ArrowRightCircle,
  AlertCircle,
  Clock
} from 'lucide-react';
import { CONTRACT_ADDRESSES, SAVING_CORE_ABI, USDC_ABI } from '../config/abi';

export default function SavingDashboard() {
  const { isConnected, address } = useAccount();
  const [amount, setAmount] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<number | null>(null);

  // Fetch nextPlanId to know how many plans to load
  const { data: nextPlanId } = useReadContract({
    address: CONTRACT_ADDRESSES.SavingCore,
    abi: SAVING_CORE_ABI,
    functionName: 'nextPlanId',
  });

  // This would typically be a loop in a real component,
  // but for this demo we'll implement the logic for one a few plans
  const PlanCard = ({ id }: { id: number }) => {
    const { data: plan } = useReadContract({
      address: CONTRACT_ADDRESSES.SavingCore,
      abi: SAVING_CORE_ABI,
      functionName: 'getPlan',
      args: [BigInt(id)],
    });

    if (!plan) return <div className="p-4 border rounded-lg animate-pulse bg-gray-50" />;
    const p = plan[0] as any;

    if (!p.enabled) return null;

    return (
      <div
        onClick={() => setSelectedPlan(id)}
        className={`p-6 border rounded-xl cursor-pointer transition-all ${
          selectedPlan === id ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-gray-200 hover:border-blue-300'
        }`}
      >
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-bold">Plan #{id}</h3>
          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded">Active</span>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <p className="text-gray-500 text-sm">APR</p>
            <p className="text-xl font-bold text-blue-600">{(Number(p.aprBps) / 100).toFixed(2)}%</p>
          </div>
          <div>
            <p className="text-gray-500 text-sm">Tenor</p>
            <p className="text-xl font-bold">{Number(p.tenorDays)} Days</p>
          </div>
        </div>
        <div className="text-xs text-gray-400 flex items-center gap-1">
          <AlertCircle size={12} />
          Min: {Number(p.minDeposit) / 1e6} USDC | Max: {Number(p.maxDeposit) / 1e6} USDC
        </div>
      </div>
    );
  };

  const { writeContract, data: hash } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const handleDeposit = async () => {
    if (!selectedPlan || !amount) return;

    const amountWei = BigInt(parseFloat(amount) * 1e6);

    // 1. Check Allowance
    // (Simplified: in real app, call USDC.allowance and then USDC.approve if needed)

    writeContract({
      address: CONTRACT_ADDRESSES.SavingCore,
      abi: SAVING_CORE_ABI,
      functionName: 'openDeposit',
      args: [BigInt(selectedPlan), amountWei],
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-gray-900">
      {/* Header */}
      <header className="max-w-6xl mx-auto flex justify-between items-center mb-12">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
            <TrendingUp className="text-blue-600" />
            Saving<span className="text-blue-600">Vault</span>
          </h1>
          <p className="text-gray-500">High-yield USDC saving certificates</p>
        </div>
        <div className="flex items-center gap-4">
          {!isConnected ? (
            <button className="bg-blue-600 text-white px-6 py-2 rounded-full font-medium hover:bg-blue-700 transition-colors flex items-center gap-2">
              <Wallet size={18} /> Connect Wallet
            </button>
          ) : (
            <div className="bg-white border px-4 py-2 rounded-full text-sm font-mono shadow-sm">
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Left: Market */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <PlusCircle className="text-blue-500" /> Available Saving Plans
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {nextPlanId && Array.from({ length: Number(nextPlanId) - 1 }, (_, i) => <PlanCard key={i+1} id={i+1} />)}
          </div>
        </div>

        {/* Right: Action Panel */}
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 h-fit sticky top-8">
          <h2 className="text-xl font-bold mb-6">Open Deposit</h2>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Amount (USDC)</label>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-4 pr-12 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
                <span className="absolute right-4 top-3 text-gray-400 font-medium">USDC</span>
              </div>
            </div>

            {selectedPlan ? (
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-blue-600 font-medium">Selected Plan #{selectedPlan}</span>
                  <span className="text-sm font-bold text-blue-700">{(Number(nextPlanId) / 100).toFixed(2)}% APR</span>
                </div>
                <div className="flex justify-between items-center text-xs text-gray-500">
                  <span>Estimated Maturity</span>
                  <span className="flex items-center gap-1"><Clock size={12}/> 30 Days</span>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-center text-sm text-gray-500">
                Please select a plan from the market
              </div>
            )}

            <button
              disabled={!selectedPlan || !amount || isConfirming}
              onClick={handleDeposit}
              className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {isConfirming ? "Confirming..." : "Deposit Funds"}
              <ArrowRightCircle size={20} />
            </button>

            {isConfirmed && (
              <div className="p-4 bg-green-50 text-green-700 rounded-xl text-sm font-medium border border-green-100 flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-ping" />
                Deposit successful! Certificate minted.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
