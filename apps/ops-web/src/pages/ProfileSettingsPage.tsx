import { RobotOutlined, UploadOutlined } from "@ant-design/icons";
import { App, Avatar, Button, Form, Input, Select, Space, Typography, Upload } from "antd";
import { useState } from "react";

type ProfileForm = {
  account: string;
  nickname: string;
  bio: string;
  country: string;
  team: string;
  address: string;
  phone_prefix: string;
  phone: string;
};

const STORAGE_KEY = "ops_admin_profile_settings";

const defaultProfile: ProfileForm = {
  account: "admin",
  nickname: "焕甲运营",
  bio: "负责焕甲平台的运营数据、用户增长、门店协同和活动复盘。",
  country: "中国",
  team: "运营团队",
  address: "深圳市南山区",
  phone_prefix: "+971",
  phone: "525809014",
};

const settingTabs = ["基本设置", "安全设置", "账号绑定", "新消息通知"];

function loadProfile(): ProfileForm {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultProfile;
  try {
    return { ...defaultProfile, ...JSON.parse(raw), phone_prefix: "+971", phone: "525809014" };
  } catch {
    return defaultProfile;
  }
}

export function ProfileSettingsPage() {
  const { message } = App.useApp();
  const [activeTab, setActiveTab] = useState("基本设置");
  const [form] = Form.useForm<ProfileForm>();

  function saveProfile(values: ProfileForm) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
    message.success("已更新基本信息");
  }

  return (
    <div className="profile-settings-page">
      <aside className="profile-settings-nav">
        {settingTabs.map((item) => (
          <button
            type="button"
            key={item}
            className={`profile-settings-nav-item${item === activeTab ? " is-active" : ""}`}
            onClick={() => setActiveTab(item)}
          >
            {item}
          </button>
        ))}
      </aside>

      <main className="profile-settings-main">
        <Typography.Title level={3} className="profile-settings-title">
          {activeTab}
        </Typography.Title>

        {activeTab === "基本设置" ? (
          <div className="profile-settings-grid">
            <Form
              form={form}
              layout="vertical"
              initialValues={loadProfile()}
              onFinish={saveProfile}
              className="profile-settings-form"
            >
              <Form.Item label="账号" name="account">
                <Input allowClear disabled />
              </Form.Item>

              <Form.Item label="昵称" name="nickname" rules={[{ required: true, message: "请输入昵称" }]}>
                <Input allowClear />
              </Form.Item>

              <Form.Item label="个人简介" name="bio">
                <Input.TextArea rows={4} maxLength={160} placeholder="个人简介" />
              </Form.Item>

              <Form.Item label="国家/地区" name="country">
                <Select
                  options={[
                    { value: "中国", label: "中国" },
                    { value: "新加坡", label: "新加坡" },
                    { value: "阿联酋", label: "阿联酋" },
                  ]}
                />
              </Form.Item>

              <Form.Item label="所属团队" name="team">
                <Select
                  options={[
                    { value: "运营团队", label: "运营团队" },
                    { value: "商家运营", label: "商家运营" },
                    { value: "内容运营", label: "内容运营" },
                    { value: "增长团队", label: "增长团队" },
                  ]}
                />
              </Form.Item>

              <Form.Item label="办公地点" name="address">
                <Input allowClear placeholder="办公地点" />
              </Form.Item>

              <Form.Item label="联系电话">
                <Space.Compact className="profile-phone-row">
                  <Form.Item name="phone_prefix" noStyle>
                    <Input className="profile-phone-prefix" />
                  </Form.Item>
                  <Form.Item name="phone" noStyle>
                    <Input />
                  </Form.Item>
                </Space.Compact>
              </Form.Item>

              <Button type="primary" htmlType="submit">
                更新基本信息
              </Button>
            </Form>

            <div className="profile-avatar-panel">
              <Typography.Text strong>头像</Typography.Text>
              <Avatar size={168} className="profile-avatar" icon={<RobotOutlined />} />
              <Upload showUploadList={false} beforeUpload={() => false}>
                <Button icon={<UploadOutlined />}>更换头像</Button>
              </Upload>
            </div>
          </div>
        ) : (
          <div className="profile-settings-placeholder">
            <Typography.Title level={4}>{activeTab}</Typography.Title>
            <Typography.Paragraph type="secondary">
              这里预留为运营后台账号配置项，后续接入真实账号体系后再落库。
            </Typography.Paragraph>
          </div>
        )}
      </main>
    </div>
  );
}
