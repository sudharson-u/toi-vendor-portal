export type SubscriptionStatus = 'active' | 'renew_soon' | 'expiring_this_month' | 'expired' | 'renewed';
export type NotificationStatus = 'pending' | 'notified' | 'dismissed' | 'renewed';

export interface Vendor {
  id: string;
  vendor_name: string;
  mobile_number?: string;
  created_at: string;
  updated_at: string;
  customer_count?: number;
}

export interface Customer {
  id: string;
  customer_id: string;
  customer_name: string;
  address: string;
  mobile_number: string;
  order_id: string;
  notes?: string;
  vendor_id?: string;
  vendor?: Vendor;
  created_at: string;
  updated_at: string;
  current_subscription?: Subscription;
  subscriptions?: Subscription[];
}

export interface Subscription {
  id: string;
  customer_id: string;
  start_date: string;
  end_date: string;
  status: SubscriptionStatus;
  is_current: boolean;
  notification_date?: string;
  created_at: string;
  updated_at: string;
}
