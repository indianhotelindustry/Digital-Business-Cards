import React from 'react';
import { useAuth } from '../../context/AuthContext';

// Directive 34 Phase 1: individuals have an ACTIVE free account; their card workspace is Phase 4.
// No demo fallbacks (the employee portal used 'emp_acme_rahul' when employeeId was null).
export const IndividualHomeView: React.FC = () => {
  const { userProfile } = useAuth();
  return (
    <div className="max-w-xl mx-auto p-6 space-y-3" data-testid="individual-home">
      <h1 className="text-xl font-bold text-slate-900">Welcome, {userProfile?.displayName}</h1>
      <p className="text-sm text-slate-600">Your free DSBC account is active. Creating your own card from here is coming next.</p>
    </div>
  );
};
