import { App, Form, Input, InputNumber, Modal } from "antd";
import { api, CouponGrantPayload } from "../api/client";

type CouponGrantModalProps = {
  open: boolean;
  target?: {
    type: "user";
    id: string;
    name: string;
  };
  onCancel: () => void;
  onDone: () => void;
};

type FormValues = {
  coupon_name: string;
  amount: number;
  expiry_date?: string;
  note?: string;
};

function defaultExpiryDate() {
  const value = new Date();
  value.setMonth(value.getMonth() + 3);
  return value.toISOString().slice(0, 10);
}

export function CouponGrantModal({ open, target, onCancel, onDone }: CouponGrantModalProps) {
  const [form] = Form.useForm<FormValues>();
  const { message } = App.useApp();

  return (
    <Modal
      title={target ? `发券给 ${target.name}` : "发放优惠券"}
      open={open}
      okText="发放"
      cancelText="取消"
      destroyOnHidden
      onCancel={onCancel}
      onOk={() => form.submit()}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ coupon_name: "运营优惠券", amount: 20, expiry_date: defaultExpiryDate() }}
        onFinish={async (values) => {
          if (!target) return;
          const payload: CouponGrantPayload = {
            target_type: target.type,
            target_id: target.id,
            coupon_name: values.coupon_name,
            amount: values.amount,
            expiry_date: values.expiry_date || undefined,
            note: values.note ?? "",
          };
          try {
            await api.createCouponGrant(payload);
            message.success("已发放");
            form.resetFields();
            onDone();
          } catch (error) {
            message.error(error instanceof Error ? error.message : "发放失败");
          }
        }}
      >
        <Form.Item name="coupon_name" label="券名" rules={[{ required: true, message: "请输入券名" }]}>
          <Input maxLength={120} />
        </Form.Item>
        <Form.Item name="amount" label="金额" rules={[{ required: true, message: "请输入金额" }]}>
          <InputNumber min={1} precision={0} className="full-width" addonAfter="元" />
        </Form.Item>
        <Form.Item name="expiry_date" label="过期日期">
          <Input type="date" />
        </Form.Item>
        <Form.Item name="note" label="备注">
          <Input.TextArea rows={3} maxLength={500} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
