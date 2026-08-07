export const CATEGORIES = {
  RENT: {
    label: 'Rental property',
    icon: 'home',
    color: '#393680',
    identifierLabel: 'House / unit no.',
    identifierPlaceholder: 'B4',
    amountLabel: 'Monthly rent (KSh)',
    memberNoun: 'tenant',
    primaryLabel: 'Rent',
    supportsUtilities: true,
  },
  SCHOOL_FEES: {
    label: 'School fees',
    icon: 'gradCap',
    color: '#3fa6dd',
    identifierLabel: 'Student / admission no.',
    identifierPlaceholder: 'F2W-04',
    amountLabel: 'Fee amount per period (KSh)',
    memberNoun: 'student',
    primaryLabel: 'Fees',
    supportsUtilities: false,
  },
  MEMBERSHIP: {
    label: 'Membership / chama',
    icon: 'handshake',
    color: '#ef9f27',
    identifierLabel: 'Member no.',
    identifierPlaceholder: 'M-03',
    amountLabel: 'Monthly contribution (KSh)',
    memberNoun: 'member',
    primaryLabel: 'Contribution',
    supportsUtilities: false,
  },
  OTHER: {
    label: 'Other',
    icon: 'card',
    color: '#1d9e75',
    identifierLabel: 'Reference',
    identifierPlaceholder: 'REF-01',
    amountLabel: 'Amount due (KSh)',
    memberNoun: 'payer',
    primaryLabel: 'Amount',
    supportsUtilities: false,
  },
};

export function categoryMeta(category) {
  return CATEGORIES[category] || CATEGORIES.OTHER;
}
