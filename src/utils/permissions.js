export const hasPermission = (permissions, key) => Boolean(permissions && permissions[key]);

const hasAnySettingPermission = (permissions = {}) => (
  hasPermission(permissions, 'settings.clinic') ||
  hasPermission(permissions, 'settings.catalog') ||
  hasPermission(permissions, 'settings.communication') ||
  hasPermission(permissions, 'settings.policies') ||
  hasPermission(permissions, 'settings.users_access') ||
  hasPermission(permissions, 'settings.permissions')
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
