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
      alert('用户名不能为空。');
      return;
    }
    if (!isEditingUser && !userFormData.password) {
      alert('创建用户时必须填写密码。');
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
        throw new Error(await extractResponseMessage(response, '保存用户失败'));
      }
      alert(isEditingUser ? '用户已更新。' : '用户已创建。');
      closeUserModal();
      refreshData('users');
    } catch (error) {
      alert(`保存用户失败：${error.message}`);
    }
  };

  const handleDeleteUser = async (user) => {
    if (!confirm(`确定删除用户“${user.username}”吗？`)) return;
    try {
      const response = await safeFetch(`/api/users/${user.id}/`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(await extractResponseMessage(response, '删除用户失败'));
      }
      refreshData('users');
    } catch (error) {
      alert(`删除用户失败：${error.message}`);
    }
  };

  const handleToggleUserActive = async (user) => {
    if (user.username === currentUserInfo?.username) {
      alert('不能停用当前正在登录的用户。');
      return;
    }

    const nextActive = !user.is_active;
    if (!confirm(`确定要${nextActive ? '启用' : '停用'}用户“${user.username}”吗？`)) return;

    try {
      const response = await safeFetch(`/api/users/${user.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: nextActive }),
      });
      if (!response.ok) {
        throw new Error(await extractResponseMessage(response, '更新用户状态失败'));
      }
      refreshData('users');
    } catch (error) {
      alert(`更新用户状态失败：${error.message}`);
    }
  };

  const handleUnlockUser = async (userId) => {
    try {
      const response = await safeFetch(`/api/users/${userId}/unlock/`, { method: 'POST' });
      if (!response.ok) {
        throw new Error(await extractResponseMessage(response, '解锁用户失败'));
      }
      alert('用户已解锁。');
      refreshData('users');
    } catch (error) {
      alert(`解锁用户失败：${error.message}`);
    }
  };

  const handleResetConfirm = async () => {
    if (!resetTarget.password) {
      alert('新密码不能为空。');
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
        throw new Error(await extractResponseMessage(response, '重置密码失败'));
      }
      alert('密码已重置。');
      setIsResetModalOpen(false);
      setResetTarget({});
      refreshData('users');
    } catch (error) {
      alert(`重置密码失败：${error.message}`);
    }
  };

  const handleChangeOwnPassword = async () => {
    if (!passwordFormData.current_password || !passwordFormData.new_password) {
      alert('当前密码和新密码都不能为空。');
      return;
    }
    if (passwordFormData.new_password !== passwordFormData.confirm_password) {
      alert('两次输入的新密码不一致。');
      return;
    }

    try {
      const response = await changePasswordRequest({
        current_password: passwordFormData.current_password,
        new_password: passwordFormData.new_password,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || '修改密码失败');
      }
      updateCurrentUserInfo(data.user);
      setPasswordFormData({ current_password: '', new_password: '', confirm_password: '' });
      setIsPasswordChangeModalOpen(false);
      alert('密码修改成功。');
    } catch (error) {
      alert(`修改密码失败：${error.message}`);
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
