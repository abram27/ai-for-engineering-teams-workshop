'use client';

import { useMemo, useState } from 'react';
import type { Customer } from '@/data/mock-customers';
import CustomerCard from './CustomerCard';

export interface CustomerSelectorProps {
  customers: Customer[];
  selectedCustomerId?: string;
  onSelectCustomer?: (customer: Customer) => void;
}

function sanitizeSearchTerm(term: string): string {
  return term.trim().toLowerCase();
}

export default function CustomerSelector({
  customers,
  selectedCustomerId,
  onSelectCustomer,
}: CustomerSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [internalSelectedId, setInternalSelectedId] = useState<string | undefined>(
    selectedCustomerId
  );

  const activeSelectedId = selectedCustomerId ?? internalSelectedId;

  const filteredCustomers = useMemo(() => {
    const normalized = sanitizeSearchTerm(searchTerm);
    if (!normalized) {
      return customers;
    }
    return customers.filter((customer) => {
      const name = customer.name?.toLowerCase() ?? '';
      const company = customer.company?.toLowerCase() ?? '';
      return name.includes(normalized) || company.includes(normalized);
    });
  }, [customers, searchTerm]);

  function handleSelect(customer: Customer) {
    setInternalSelectedId(customer.id);
    onSelectCustomer?.(customer);
  }

  return (
    <div className="w-full">
      <div className="mb-4">
        <label htmlFor="customer-search" className="sr-only">
          Search customers by name or company
        </label>
        <input
          id="customer-search"
          type="text"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search by name or company..."
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {filteredCustomers.length === 0 ? (
        <div className="flex w-full items-center justify-center rounded-lg border border-dashed border-gray-300 p-8 text-center">
          <p className="text-sm text-gray-500">
            No customers match your search. Try a different name or company.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredCustomers.map((customer) => (
            <CustomerCard
              key={customer.id}
              customer={customer}
              isSelected={customer.id === activeSelectedId}
              onSelect={() => handleSelect(customer)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
