import type { Customer } from '@/data/mock-customers';

export interface CustomerCardProps {
  customer: Customer;
}

function getHealthColorClasses(healthScore: number): string {
  if (healthScore <= 30) {
    return 'bg-red-100 text-red-800 border-red-300';
  }
  if (healthScore <= 70) {
    return 'bg-yellow-100 text-yellow-800 border-yellow-300';
  }
  return 'bg-green-100 text-green-800 border-green-300';
}

export default function CustomerCard({ customer }: CustomerCardProps) {
  const { name, company, healthScore, domains } = customer;
  const healthColorClasses = getHealthColorClasses(healthScore);
  const domainCount = domains?.length ?? 0;

  return (
    <div
      className={`w-full rounded-lg border p-4 shadow-sm sm:p-5 ${healthColorClasses}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-gray-900 sm:text-lg">
            {name}
          </h3>
          <p className="truncate text-sm text-gray-700">{company}</p>
        </div>

        <span className="shrink-0 rounded-full border border-current px-2.5 py-1 text-xs font-medium">
          {healthScore}
        </span>
      </div>

      <div className="mt-3 border-t border-current/20 pt-3">
        {domainCount > 0 ? (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-600">
              {domainCount > 1 ? `Domains (${domainCount})` : 'Domain'}
            </p>
            <ul className="mt-1 space-y-0.5">
              {domains!.map((domain) => (
                <li key={domain} className="truncate text-sm text-gray-800">
                  {domain}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-gray-600">No domains configured</p>
        )}
      </div>
    </div>
  );
}
