import { changePasswordRequest, safeFetch } from '../lib/api';


export function useUserManagementHandlers({
  alert,
  currentUserInfo,
  extractResponseMessage,
  passwordFormData,
  refreshData,
  resetTarget,
  setIsPasswordChangeModalOpen,
  setIsResetModalOpen,
  setIsUserModalOpen,
  setPasswordFormData,
  setResetTarget,
  setUserFormData,
  setUserModalMode,
  updateCurrentUserInfo,
  userFormData,
  userModalMode,
}) {
  const closeUserModal = () => {
    setIsUserModalOpen(false);
    setUserModalMode('create');
    setUserFormData({});
  };

  const handleOpenCreateUser = () => {
    setUserModalMode('create');
    setUserFormData({
      role: 'guest',
      is_active: true,
      must_change_password: true,
      department: '',
      phone: '',
      title: '',
      display_name: '',
    });
    setIsUserModalOpen(true);
  };

  const handleOpenEditUser = (user) => {
    setUserModalMode('edit');
    setUserFormData({
      id: user.id,
      username: user.username,
      display_name: user.display_name || user.username,
      department: user.department || '',
      phone: user.phone || '',
      title: user.title || '',
      role: user.role || 'guest',
      is_active: user.is_active,
      must_change_password: !!user.must_change_password,
    });
    setIsUserModalOpen(true);
  };

  const handleSaveUser = async () => {
    const isEditingUser = userModalMode === 'edit' && userFormData.id;
    if (!userFormData.username) {
      alert('Username is required.');
      return;
    }
    if (!isEditingUser && !userFormData.password) {
      alert('Password is required when creating a user.');
      return;
    }

    const payload = {
      username: userFormData.username,
      display_name: userFormData.display_name || userFormData.username,
      department: userFormData.department || '',
      phone: userFormData.phone || '',
      title: userFormData.title || '',
      role: userFormData.role || 'guest',
      is_active: userFormData.is_active ?? true,
      must_change_password: userFormData.must_change_password ?? true,
    };
    if (!isEditingUser) {
      payload.password = userFormData.password;
    }

    try {
      const url = isEditingUser ? `/api/users/${userFormData.id}/` : '/api/users/';
      const method = isEditingUser ? 'PATCH' : 'POST';
      const response = await safeFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(await extractResponseMessage(response, 'Failed to save user'));
      }
      alert(isEditingUser ? 'User updated.' : 'User created.');
      closeUserModal();
      refreshData('users');
    } catch (error) {
      alert(`Failed to save user: ${error.message}`);
    }
  };

  const handleDeleteUser = async (user) => {
    if (!confirm(`Delete user ${user.username}?`)) return;
    try {
      const response = await safeFetch(`/api/users/${user.id}/`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(await extractResponseMessage(response, 'Failed to delete user'));
      }
      refreshData('users');
    } catch (error) {
      alert(`Failed to delete user: ${error.message}`);
    }
  };

  const handleToggleUserActive = async (user) => {
    if (user.username === currentUserInfo?.username) {
      alert('You cannot disable the currently logged-in user.');
      return;
    }

    const nextActive = !user.is_active;
    if (!confirm(`${nextActive ? 'Enable' : 'Disable'} user ${user.username}?`)) return;

    try {
      const response = await safeFetch(`/api/users/${user.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: nextActive }),
      });
      if (!response.ok) {
        throw new Error(await extractResponseMessage(response, 'Failed to update user status'));
      }
      refreshData('users');
    } catch (error) {
      alert(`Failed to update user status: ${error.message}`);
    }
  };

  const handleUnlockUser = async (userId) => {
    try {
      const response = await safeFetch(`/api/users/${userId}/unlock/`, { method: 'POST' });
      if (!response.ok) {
        throw new Error(await extractResponseMessage(response, 'Failed to unlock user'));
      }
      alert('User unlocked.');
      refreshData('users');
    } catch (error) {
      alert(`Failed to unlock user: ${error.message}`);
    }
  };

  const handleResetConfirm = async () => {
    if (!resetTarget.password) {
      alert('New password is required.');
      return;
    }

    try {
      const response = await safeFetch(`/api/users/${resetTarget.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: resetTarget.password,
          must_change_password: resetTarget.must_change_password ?? true,
        }),
      });
      if (!response.ok) {
        throw new Error(await extractResponseMessage(response, 'Failed to reset password'));
      }
      alert('Password reset completed.');
      setIsResetModalOpen(false);
      setResetTarget({});
      refreshData('users');
    } catch (error) {
      alert(`Failed to reset password: ${error.message}`);
    }
  };

  const handleChangeOwnPassword = async () => {
    if (!passwordFormData.current_password || !passwordFormData.new_password) {
      alert('Current password and new password are required.');
      return;
    }
    if (passwordFormData.new_password !== passwordFormData.confirm_password) {
      alert('The new password confirmation does not match.');
      return;
    }

    try {
      const response = await changePasswordRequest({
        current_password: passwordFormData.current_password,
        new_password: passwordFormData.new_password,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || 'Failed to change password');
      }
      updateCurrentUserInfo(data.user);
      setPasswordFormData({ current_password: '', new_password: '', confirm_password: '' });
      setIsPasswordChangeModalOpen(false);
      alert('Password changed successfully.');
    } catch (error) {
      alert(`Failed to change password: ${error.message}`);
    }
  };

  return {
    closeUserModal,
    handleOpenCreateUser,
    handleOpenEditUser,
    handleSaveUser,
    handleDeleteUser,
    handleToggleUserActive,
    handleUnlockUser,
    handleResetConfirm,
    handleChangeOwnPassword,
  };
}
