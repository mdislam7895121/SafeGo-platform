import CmsLegalPage from "@/components/landing/CmsLegalPage";

const PrivacyFallbackContent = () => (
  <>
    <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
      Privacy Policy – SafeGo
    </p>

    <section className="mb-8">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">1. Introduction</h2>
      <p className="text-gray-600 dark:text-gray-400">
        SafeGo ("we", "us", "our") provides ride, food delivery, and parcel services. This Privacy Policy explains how we collect, use, and protect your information when you visit safegoglobal.com or use our apps and services.
      </p>
    </section>

    <section className="mb-8">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">2. Information we collect</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-3">We may collect:</p>
      <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400 space-y-2">
        <li>Account information (name, phone number, email, password)</li>
        <li>Trip and delivery information (pickup/drop-off, route, time, distance)</li>
        <li>Payment-related information (masked card details)</li>
        <li>Device information (IP, browser, OS, crash logs)</li>
        <li>Support messages and communication logs</li>
      </ul>
    </section>

    <section className="mb-8">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">3. How we use your information</h2>
      <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400 space-y-2">
        <li>Create and manage accounts</li>
        <li>Provide rides and deliveries</li>
        <li>Calculate pricing and payouts</li>
        <li>Detect and prevent fraud</li>
        <li>Improve app performance</li>
        <li>Communicate trip/order updates</li>
      </ul>
    </section>

    <section className="mb-8">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">4. Sharing</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-3">We share information only with:</p>
      <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400 space-y-2">
        <li>Drivers, couriers, restaurants, and shop partners</li>
        <li>Payment processors</li>
        <li>Cloud hosting and analytics providers</li>
        <li>Law enforcement when required</li>
      </ul>
      <p className="text-gray-600 dark:text-gray-400 mt-4 font-medium">
        We do not sell your personal data.
      </p>
    </section>

    <section className="mb-8">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">5. Security</h2>
      <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400 space-y-2">
        <li>HTTPS encryption</li>
        <li>Access control</li>
        <li>Activity logs and monitoring</li>
      </ul>
      <p className="text-gray-600 dark:text-gray-400 mt-4">
        No system is perfect, but we work to reduce risk.
      </p>
    </section>

    <section className="mb-8">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">6. Data retention</h2>
      <p className="text-gray-600 dark:text-gray-400">
        We keep data only as long as legally required or for service operations.
      </p>
    </section>

    <section className="mb-8">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">7. Your rights</h2>
      <p className="text-gray-600 dark:text-gray-400">
        You may request access, correction, or deletion where permitted by law.
      </p>
    </section>

    <section className="mb-8">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">8. Contact</h2>
      <p className="text-gray-600 dark:text-gray-400">
        <a href="mailto:support@safegoglobal.com" className="text-blue-600 hover:underline">support@safegoglobal.com</a>
      </p>
      <p className="text-gray-500 dark:text-gray-500 mt-4 text-sm">
        Last updated: 2025
      </p>
    </section>
  </>
);

export default function PrivacyPage() {
  return (
    <CmsLegalPage
      slug="privacy"
      fallbackTitle="Privacy Policy"
      fallbackContent={<PrivacyFallbackContent />}
      seoTitle="Privacy Policy | SafeGo"
      seoDescription="Learn how SafeGo collects, uses, and protects your personal information. Our privacy policy covers data handling for ride-hailing, food delivery, and parcel services."
      seoKeywords="privacy policy, data protection, personal information, SafeGo privacy"
    />
  );
}
