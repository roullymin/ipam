import React from 'react';
import { AlertTriangle, ChevronDown, Shield } from 'lucide-react';
import { FormInput, Modal } from './common/UI';

export default function AuthManagementModals({
  isUserModalOpen,
  setIsUserModalOpen,
  userModalMode,
  userFormData,
  setUserFormData,
  roleDefinitions,
  handleSaveUser,
  isResetModalOpen,
  setIsResetModalOpen,
  resetTarget,
  setResetTarget,
  handleResetConfirm,
  isPasswordChangeModalOpen,
  setIsPasswordChangeModalOpen,
  currentUserInfo,
  passwordFormData,
  setPasswordFormData,
  handleChangeOwnPassword,
  isBlockModalOpen,
  setIsBlockModalOpen,
  blockFormData,
  setBlockFormData,
  handleBlockIP,
}) {
  const isEditing = userModalMode === 'edit';

  return (
    <>
      {isUserModalOpen && (
        <Modal
          isOpen={isUserModalOpen}
          onClose={() => setIsUserModalOpen(false)}
          title={isEditing ? '编辑用户权限与资料' : '创建用户账号'}
        >
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <FormInput
                label="登录账号"
                value={userFormData.username || ''}
                onChange={(e) => setUserFormData({ ...userFormData, username: e.target.value })}
                required
                disabled={isEditing}
              />
              <FormInput
                label="显示名称"
                value={userFormData.display_name || ''}
                onChange={(e) =>
                  setUserFormData({ ...userFormData, display_name: e.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormInput
                label="所属部门"
                value={userFormData.department || ''}
                onChange={(e) => setUserFormData({ ...userFormData, department: e.target.value })}
              />
              <FormInput
                label="联系电话"
                value={userFormData.phone || ''}
                onChange={(e) => setUserFormData({ ...userFormData, phone: e.target.value })}
              />
              <FormInput
                label="岗位 / 头衔"
                value={userFormData.title || ''}
                onChange={(e) => setUserFormData({ ...userFormData, title: e.target.value })}
              />
            </div>

            {!isEditing && (
              <FormInput
                label="初始密码"
                type="password"
                value={userFormData.password || ''}
                onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                required
              />
            )}

            {isEditing && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">
                编辑用户时不直接在这里修改密码。如果要重置密码，请使用列表里的“重置密码”操作。
              </div>
            )}

            <div className="relative">
              <label className="mb-1.5 block text-xs font-semibold uppercase text-slate-500">
                分配角色
              </label>
              <div className="relative">
                <select
                  value={userFormData.role || 'guest'}
                  onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value })}
                  className="w-full appearance-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                >
                  {Object.keys(roleDefinitions).map((key) => (
                    <option key={key} value={key}>
                      {roleDefinitions[key].label}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <ChevronDown className="h-4 w-4" />
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <label className="flex items-center justify-between text-sm text-slate-700">
                <span>账号启用</span>
                <input
                  type="checkbox"
                  checked={userFormData.is_active ?? true}
                  onChange={(e) => setUserFormData({ ...userFormData, is_active: e.target.checked })}
                />
              </label>
              <label className="flex items-center justify-between text-sm text-slate-700">
                <span>下次登录强制修改密码</span>
                <input
                  type="checkbox"
                  checked={userFormData.must_change_password ?? true}
                  onChange={(e) =>
                    setUserFormData({
                      ...userFormData,
                      must_change_password: e.target.checked,
                    })
                  }
                />
              </label>
            </div>

            <button
              onClick={handleSaveUser}
              className="mt-4 w-full rounded-xl bg-blue-600 py-3 font-bold text-white shadow-lg hover:bg-blue-700"
              type="button"
            >
              {isEditing ? '保存用户资料与权限' : '创建并分配角色'}
            </button>
          </div>
        </Modal>
      )}

      {isResetModalOpen && (
        <Modal isOpen={isResetModalOpen} onClose={() => setIsResetModalOpen(false)} title="重置密码">
          <div className="space-y-5">
            <FormInput
              label="新密码"
              type="password"
              value={resetTarget.password || ''}
              onChange={(e) => setResetTarget({ ...resetTarget, password: e.target.value })}
              required
            />
            <label className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <span>下次登录强制修改密码</span>
              <input
                type="checkbox"
                checked={resetTarget.must_change_password ?? true}
                onChange={(e) =>
                  setResetTarget({ ...resetTarget, must_change_password: e.target.checked })
                }
              />
            </label>
            <p className="flex items-center rounded-lg border border-amber-100 bg-amber-50 p-3 text-[10px] text-slate-500">
              <AlertTriangle className="mr-2 h-3 w-3 text-amber-500" />
              修改后该用户会立即使用新密码，建议同时要求其下次登录完成改密。
            </p>
            <button
              onClick={handleResetConfirm}
              className="w-full rounded-xl bg-blue-600 py-3 font-bold text-white shadow-lg"
              type="button"
            >
              确认重置
            </button>
          </div>
        </Modal>
      )}

      {isPasswordChangeModalOpen && (
        <Modal
          isOpen={isPasswordChangeModalOpen}
          onClose={() => {
            if (!currentUserInfo?.must_change_password) {
              setIsPasswordChangeModalOpen(false);
            }
          }}
          title={currentUserInfo?.must_change_password ? '首次登录请先修改密码' : '修改个人密码'}
        >
          <div className="space-y-5">
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
              {currentUserInfo?.must_change_password
                ? '为了满足生产环境安全要求，首次登录必须先修改密码，修改成功后才能继续使用系统。'
                : '建议定期更新个人密码，并避免与其他系统共用相同密码。'}
            </div>
            <FormInput
              label="当前密码"
              type="password"
              value={passwordFormData.current_password}
              onChange={(e) =>
                setPasswordFormData({ ...passwordFormData, current_password: e.target.value })
              }
              required
            />
            <FormInput
              label="新密码"
              type="password"
              value={passwordFormData.new_password}
              onChange={(e) =>
                setPasswordFormData({ ...passwordFormData, new_password: e.target.value })
              }
              required
            />
            <FormInput
              label="确认新密码"
              type="password"
              value={passwordFormData.confirm_password}
              onChange={(e) =>
                setPasswordFormData({ ...passwordFormData, confirm_password: e.target.value })
              }
              required
            />
            <div className="flex justify-end gap-3 pt-2">
              {!currentUserInfo?.must_change_password && (
                <button
                  onClick={() => setIsPasswordChangeModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-5 py-2.5 text-slate-500 hover:bg-slate-50"
                  type="button"
                >
                  取消
                </button>
              )}
              <button
                onClick={handleChangeOwnPassword}
                className="rounded-xl bg-blue-600 px-6 py-2.5 font-bold text-white shadow-lg hover:bg-blue-700"
                type="button"
              >
                确认修改
              </button>
            </div>
          </div>
        </Modal>
      )}

      {isBlockModalOpen && (
        <Modal isOpen={isBlockModalOpen} onClose={() => setIsBlockModalOpen(false)} title="新增黑名单">
          <div className="space-y-4">
            <div className="flex items-start rounded-xl border border-red-100 bg-red-50 p-3">
              <Shield className="mr-3 mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
              <div className="text-[11px] leading-tight text-red-800">
                注意：被加入黑名单的 IP 会被系统策略拦截。
              </div>
            </div>
            <FormInput
              label="封禁 IP"
              value={blockFormData.ip_address || ''}
              onChange={(e) => setBlockFormData({ ...blockFormData, ip_address: e.target.value })}
              required
              placeholder="183.10.x.x"
            />
            <FormInput
              label="封禁原因"
              value={blockFormData.reason || ''}
              onChange={(e) => setBlockFormData({ ...blockFormData, reason: e.target.value })}
            />
            <button
              onClick={handleBlockIP}
              className="w-full rounded-xl bg-red-600 py-3 font-bold text-white shadow-lg hover:bg-red-700"
              type="button"
            >
              立即封禁
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
