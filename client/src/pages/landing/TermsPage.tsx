import CmsLegalPage from "@/components/landing/CmsLegalPage";

const TermsFallbackContent = () => (
  <>
    <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
      Terms of Service – SafeGo
    </p>

    <section className="mb-8">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">1. Agreement</h2>
      <p className="text-gray-600 dark:text-gray-400">
        By using SafeGo, you agree to these Terms.
      </p>
    </section>

    <section className="mb-8">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">2. Eligibility</h2>
      <p className="text-gray-600 dark:text-gray-400">
        Must be 18 or older.
      </p>
    </section>

    <section className="mb-8">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">3. Your Account</h2>
      <p className="text-gray-600 dark:text-gray-400">
        You are responsible for your login credentials.
      </p>
    </section>

    <section className="mb-8">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">4. Platform Role</h2>
      <p className="text-gray-600 dark:text-gray-400">
        SafeGo connects users with independent drivers, couriers, and restaurant partners.
      </p>
    </section>

    <section className="mb-8">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">5. Payments</h2>
      <p className="text-gray-600 dark:text-gray-400">
        You authorize SafeGo to process payments for trips, deliveries, fees, and adjustments.
      </p>
    </section>

    <section className="mb-8">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">6. Cancellation</h2>
      <p className="text-gray-600 dark:text-gray-400">
        Cancellation or no-show fees may apply.
      </p>
    </section>

    <section className="mb-8">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">7. Prohibited actions</h2>
      <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400 space-y-2">
        <li>Illegal use</li>
        <li>Fraudulent activity</li>
        <li>Threats or harassment</li>
        <li>System tampering or hacking</li>
      </ul>
    </section>

    <section className="mb-8">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">8. Liability</h2>
      <p className="text-gray-600 dark:text-gray-400">
        SafeGo is not responsible for indirect damages. Maximum liability is the cost of your trip/order.
      </p>
    </section>

    <section className="mb-8">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">9. Governing Law</h2>
      <p className="text-gray-600 dark:text-gray-400">
        Bangladesh law applies.
      </p>
    </section>

    <section className="mb-8">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">10. Contact</h2>
      <p className="text-gray-600 dark:text-gray-400">
        <a href="mailto:support@safegoglobal.com" className="text-blue-600 hover:underline">support@safegoglobal.com</a>
      </p>
    </section>
  </>
);

export default function TermsPage() {
  return (
    <CmsLegalPage
      slug="terms"
      fallbackTitle="Terms of Service"
      fallbackContent={<TermsFallbackContent />}
      seoTitle="Terms of Service | SafeGo"
      seoDescription="Read the SafeGo Terms of Service. Understand the rules and guidelines for using our ride-hailing, food delivery, and parcel delivery platform."
      seoKeywords="terms of service, user agreement, SafeGo terms, legal terms"
    />
  );
}
