const PERMISSION_ALIASES = {
  'settings.clinic_profile.edit': ['settings.clinic'],
  'settings.schedule.edit': ['settings.clinic'],
  'settings.billing_services.edit': ['settings.clinic'],
  'settings.workflow.edit': ['settings.clinic'],
  'settings.catalog.edit': ['settings.catalog'],
  'settings.communication.edit': ['settings.communication'],
  'settings.policies.edit': ['settings.policies'],
  'settings.users_access.manage': ['settings.users_access'],
  'settings.access_controls.manage': ['settings.permissions'],
  'billing.collect_payment': ['appointments.manage'],
  'billing.record_refund': ['appointments.manage'],
  'billing.print_receipt': ['appointments.manage'],
  'appointments.view_list': ['appointments.view_all', 'appointments.manage', 'appointments.consult_own'],
  'patients.view_list': ['patients.view_all', 'patients.view_own', 'patients.create_edit'],
  'doctors.view_list': ['doctors.view'],
  'doctors.view_details': ['doctors.view'],
  'doctors.create': ['doctors.manage'],
  'doctors.edit': ['doctors.manage']
};

export const hasPermission = (permissions, key) => Boolean(
  permissions && (
    permissions[key] ||
    (PERMISSION_ALIASES[key] || []).some(alias => permissions[alias])
  )
);

const hasAnySettingPermission = (permissions = {}) => (
  hasPermission(permissions, 'settings.view') ||
  hasPermission(permissions, 'settings.clinic_profile.view') ||
  hasPermission(permissions, 'settings.clinic_profile.edit') ||
  hasPermission(permissions, 'settings.schedule.view') ||
  hasPermission(permissions, 'settings.schedule.edit') ||
  hasPermission(permissions, 'settings.billing_services.view') ||
  hasPermission(permissions, 'settings.billing_services.edit') ||
  hasPermission(permissions, 'settings.workflow.view') ||
  hasPermission(permissions, 'settings.workflow.edit') ||
  hasPermission(permissions, 'settings.catalog.view') ||
  hasPermission(permissions, 'settings.catalog.edit') ||
  hasPermission(permissions, 'settings.communication.view') ||
  hasPermission(permissions, 'settings.communication.edit') ||
  hasPermission(permissions, 'settings.policies.view') ||
  hasPermission(permissions, 'settings.policies.edit') ||
  hasPermission(permissions, 'settings.users_access.manage') ||
  hasPermission(permissions, 'settings.access_controls.manage')
);

export const getAvailableTabs = ({ userRole, clinicType, hasLinkedDoctor, permissions }) => {
  const isSoloWorkspace = clinicType === 'Solo' || (!clinicType && hasLinkedDoctor);
  const tabs = [];

  if (userRole === 'doctor') {
    if (hasPermission(permissions, 'appointments.consult_own') || hasPermission(permissions, 'appointments.manage')) {
      tabs.push('appointments');
    }
    if (hasPermission(permissions, 'patients.view_own') || hasPermission(permissions, 'patients.view_all')) {
      tabs.push('patients');
    }
    if (hasAnySettingPermission(permissions)) {
      tabs.push('settings');
    }
    return tabs;
  }

  if (hasPermission(permissions, 'appointments.view_all') || hasPermission(permissions, 'appointments.manage')) {
    tabs.push('appointments');
  }
  if (!isSoloWorkspace && hasPermission(permissions, 'doctors.view')) {
    tabs.push('doctors');
  }
  if (
    hasPermission(permissions, 'patients.view_all') ||
    hasPermission(permissions, 'patients.view_own') ||
    hasPermission(permissions, 'patients.create_edit')
  ) {
    tabs.push('patients');
  }
  if (hasAnySettingPermission(permissions)) {
    tabs.push('settings');
  }

  return tabs;
};
