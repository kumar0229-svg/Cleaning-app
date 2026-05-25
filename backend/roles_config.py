# Role-Based Access Control Configuration

ROLES = {
    # View-only roles (read access to all data)
    "USER_DEPARTMENT": {
        "label": "User Department",
        "description": "View-only access to all modules",
        "can_view": True,
        "can_edit": False,
        "can_delete": False,
        "can_view_audit": False,
        "can_manage_users": False,
        "can_manage_policy": False,
    },
    "HOD_USER_DEPARTMENT": {
        "label": "HOD User Department",
        "description": "View-only access to all modules (Head of Department)",
        "can_view": True,
        "can_edit": False,
        "can_delete": False,
        "can_view_audit": False,
        "can_manage_users": False,
        "can_manage_policy": False,
    },
    "QC": {
        "label": "QC",
        "description": "Quality Control - View-only access to all modules",
        "can_view": True,
        "can_edit": False,
        "can_delete": False,
        "can_view_audit": False,
        "can_manage_users": False,
        "can_manage_policy": False,
    },
    "HEAD_QC": {
        "label": "Head QC",
        "description": "Head of Quality Control - View-only access to all modules",
        "can_view": True,
        "can_edit": False,
        "can_delete": False,
        "can_view_audit": False,
        "can_manage_users": False,
        "can_manage_policy": False,
    },
    "QA": {
        "label": "QA",
        "description": "Quality Assurance - Full read/write access (legacy role)",
        "can_view": True,
        "can_edit": True,
        "can_delete": False,
        "can_view_audit": False,
        "can_manage_users": False,
        "can_manage_policy": False,
    },
    # Full access role
    "HEAD_QA": {
        "label": "Head QA",
        "description": "Head of Quality Assurance - Full administrator access",
        "can_view": True,
        "can_edit": True,
        "can_delete": True,
        "can_view_audit": True,
        "can_manage_users": True,
        "can_manage_policy": True,
    },
    "ADMIN": {
        "label": "Administrator",
        "description": "Full system administrator access",
        "can_view": True,
        "can_edit": True,
        "can_delete": True,
        "can_view_audit": True,
        "can_manage_users": True,
        "can_manage_policy": True,
    },
}

# Helper functions for role-based checks
def can_view(role: str) -> bool:
    """Check if role can view data"""
    return ROLES.get(role, {}).get("can_view", False)

def can_edit(role: str) -> bool:
    """Check if role can edit data"""
    return ROLES.get(role, {}).get("can_edit", False)

def can_delete(role: str) -> bool:
    """Check if role can delete data"""
    return ROLES.get(role, {}).get("can_delete", False)

def can_view_audit(role: str) -> bool:
    """Check if role can view audit logs"""
    return ROLES.get(role, {}).get("can_view_audit", False)

def can_manage_users(role: str) -> bool:
    """Check if role can manage users"""
    return ROLES.get(role, {}).get("can_manage_users", False)

def can_manage_policy(role: str) -> bool:
    """Check if role can manage policies"""
    return ROLES.get(role, {}).get("can_manage_policy", False)

# Role lists for common operations
ROLES_CAN_VIEW = [r for r, conf in ROLES.items() if conf.get("can_view")]
ROLES_CAN_EDIT = [r for r, conf in ROLES.items() if conf.get("can_edit")]
ROLES_CAN_DELETE = [r for r, conf in ROLES.items() if conf.get("can_delete")]
ROLES_CAN_VIEW_AUDIT = [r for r, conf in ROLES.items() if conf.get("can_view_audit")]
ROLES_CAN_MANAGE_USERS = [r for r, conf in ROLES.items() if conf.get("can_manage_users")]
ROLES_CAN_MANAGE_POLICY = [r for r, conf in ROLES.items() if conf.get("can_manage_policy")]
