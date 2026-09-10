'use client';

import { Suspense, useMemo, useState } from 'react';
import type { Customer } from '@/data/mock-customers';
import { mockCustomers } from '@/data/mock-customers';
import CustomerSelector from '@/components/CustomerSelector';
import MarketIntelligenceWidget from '@/components/MarketIntelligenceWidget';
import CustomerHealthDisplay from '@/components/CustomerHealthDisplay';
import CustomerAlerts from '@/components/CustomerAlerts';
import { calculateHealthScore, type HealthScoreInput } from '@/lib/healthCalculator';
import type { AlertEngineInput, AlertHistoryEntry } from '@/lib/alerts';

/**
 * Derives deterministic demo health-score inputs from a customer's mock
 * `healthScore` so the health + alerts widgets have something realistic to
 * render for every customer in `mock-customers.ts`.
 */
function deriveHealthInput(customer: Customer): HealthScoreInput {
  const score = customer.healthScore;
  return {
    payment: {
      daysSinceLastPayment: score < 30 ? 45 : score < 70 ? 20 : 5,
      averagePaymentDelay: score < 30 ? 15 : score < 70 ? 5 : 1,
      overdueAmount: score < 30 ? 1200 : 0,
    },
    engagement: {
      loginFrequency: Math.max(0, Math.round(score / 15)),
      featureUsageCount: Math.max(0, Math.round(score / 3)),
      supportTickets: score < 30 ? 5 : score < 70 ? 2 : 0,
    },
    contract: {
      daysUntilRenewal: score < 30 ? 45 : 120,
      contractValue: 24000,
      recentUpgrades: score >= 70 ? 1 : 0,
    },
    support: {
      averageResolutionTime: score < 30 ? 12 : 3,
      satisfactionScore: score,
      escalationCount: score < 30 ? 1 : 0,
    },
  };
}

function deriveAlertInput(customer: Customer): AlertEngineInput {
  const score = customer.healthScore;
  const healthInput = deriveHealthInput(customer);

  return {
    customerId: customer.id,
    currentHealth: calculateHealthScore(healthInput),
    payment: { daysOverdue: score < 30 ? 40 : 0 },
    engagement: {
      last7DayLoginFrequency: score < 30 ? 1 : 5,
      last30DayAverageLoginFrequency: 5,
      newFeatureUsageInLast30Days: score >= 70 ? 2 : 0,
      isGrowingAccount: customer.subscriptionTier === 'enterprise',
      ticketsInLast7Days: score < 30 ? 4 : 0,
      hasEscalatedTicket: score < 30,
    },
    contract: { daysUntilExpiration: score < 30 ? 60 : 120 },
    arr: customer.subscriptionTier === 'enterprise' ? 120000 : customer.subscriptionTier === 'premium' ? 48000 : 12000,
    company: customer.company,
  };
}

// Dynamic component imports with error boundaries
const CustomerCardDemo = () => {
  try {
    // Try to import CustomerCard - this will work after Exercise 3
    const CustomerCard = require('../components/CustomerCard')?.default;
    const mockCustomers = require('../data/mock-customers')?.mockCustomers;
    
    if (CustomerCard && mockCustomers?.[0]) {
      return (
        <div className="space-y-4">
          <p className="text-green-600 text-sm font-medium">✅ CustomerCard implemented!</p>
          <div className="flex flex-wrap gap-4">
            <CustomerCard customer={mockCustomers[0]} />
            <CustomerCard customer={mockCustomers[1]} />
          </div>
        </div>
      );
    }
  } catch (error) {
    // Component doesn't exist yet
  }
  
  return (
    <div className="text-gray-500 text-sm">
      After Exercise 3, your CustomerCard components will appear here showing customer information with health scores.
    </div>
  );
};

const CustomerHealthDisplayDemo = () => {
  try {
    const CustomerHealthDisplay = require('../components/CustomerHealthDisplay')?.default;

    if (CustomerHealthDisplay) {
      const sampleHealthData = {
        payment: { daysSinceLastPayment: 12, averagePaymentDelay: 2, overdueAmount: 0 },
        engagement: { loginFrequency: 5, featureUsageCount: 22, supportTickets: 1 },
        contract: { daysUntilRenewal: 90, contractValue: 24000, recentUpgrades: 1 },
        support: { averageResolutionTime: 4, satisfactionScore: 88, escalationCount: 0 },
      };

      return (
        <div className="space-y-4">
          <p className="text-green-600 text-sm font-medium">✅ CustomerHealthDisplay implemented!</p>
          <div className="flex flex-wrap gap-4">
            <CustomerHealthDisplay healthData={sampleHealthData} />
          </div>
        </div>
      );
    }
  } catch (error) {
    // Component doesn't exist yet
  }

  return (
    <div className="text-gray-500 text-sm">
      After Exercise 5, your CustomerHealthDisplay widget will appear here.
    </div>
  );
};

export default function Home() {
  const [selectedCustomer, setSelectedCustomer] = useState<Customer>(mockCustomers[0]);
  const [alertHistoryByCustomer, setAlertHistoryByCustomer] = useState<
    Record<string, AlertHistoryEntry[]>
  >({});

  const healthInput = useMemo(() => deriveHealthInput(selectedCustomer), [selectedCustomer]);
  const alertInput = useMemo(() => deriveAlertInput(selectedCustomer), [selectedCustomer]);
  const selectedCustomerHistory = alertHistoryByCustomer[selectedCustomer.id] ?? [];

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          Customer Intelligence Dashboard
        </h1>
        <p className="text-gray-600">
          AI for Engineering Teams Workshop - Your Progress
        </p>
      </header>

      {/* Progress Indicator */}
      <div className="mb-8 bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Workshop Progress</h2>
        <div className="space-y-2 text-sm text-gray-600">
          <p>✅ Setup Complete - Next.js app is running</p>
          <p className="text-gray-400">⏳ Exercise 3: CustomerCard component (implement to see here)</p>
          <p className="text-gray-400">⏳ Exercise 4: CustomerSelector integration</p>
          <p className="text-gray-400">⏳ Exercise 5: Domain Health widget</p>
          <p className="text-gray-400">⏳ Exercise 9: Production-ready features</p>
        </div>
      </div>

      {/* Component Showcase Area */}
      <div className="space-y-8">
        {/* CustomerCard Section */}
        <section className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">CustomerCard Component</h3>
          <Suspense fallback={<div className="text-gray-500">Loading...</div>}>
            <CustomerCardDemo />
          </Suspense>
        </section>

        {/* CustomerHealthDisplay Section */}
        <section className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">CustomerHealthDisplay Component</h3>
          <Suspense fallback={<div className="text-gray-500">Loading...</div>}>
            <CustomerHealthDisplayDemo />
          </Suspense>
        </section>

        {/* Customer Selection */}
        <section className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Select a Customer</h3>
          <CustomerSelector
            customers={mockCustomers}
            selectedCustomerId={selectedCustomer.id}
            onSelectCustomer={setSelectedCustomer}
          />
        </section>

        {/* Health & Predictive Alerts Section (updates together on customer selection) */}
        <section className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">
            Customer Health &amp; Predictive Alerts
          </h3>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <CustomerHealthDisplay
              customerId={selectedCustomer.id}
              healthData={healthInput}
            />
            <CustomerAlerts
              customerId={selectedCustomer.id}
              alertData={alertInput}
              history={selectedCustomerHistory}
              onHistoryChange={(history) =>
                setAlertHistoryByCustomer((prev) => ({
                  ...prev,
                  [selectedCustomer.id]: history,
                }))
              }
            />
          </div>
        </section>

        {/* Dashboard Widgets Section */}
        <section className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Dashboard Widgets</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <MarketIntelligenceWidget company={selectedCustomer.company} />
          </div>
        </section>

        {/* Getting Started */}
        <section className="bg-blue-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">Ready to Start Building?</h3>
          <p className="text-blue-800 mb-4">
            Follow along with the workshop exercises to see this dashboard come to life with AI-generated components.
          </p>
          <div className="text-sm text-blue-700">
            <p className="mb-1"><strong>Next:</strong> Exercise 1 - Create your first specification</p>
            <p className="mb-1"><strong>Then:</strong> Exercise 3 - Generate your first component</p>
            <p className="text-xs text-blue-600">💡 Tip: Refresh this page after completing exercises to see your progress!</p>
          </div>
        </section>
      </div>
    </div>
  );
}
