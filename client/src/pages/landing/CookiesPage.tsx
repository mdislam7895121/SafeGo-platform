import CmsLegalPage from "@/components/landing/CmsLegalPage";

const CookiesFallbackContent = () => (
  <>
    <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
      Cookie Policy – SafeGo
    </p>

    <section className="mb-8">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">What we use cookies for</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-3">We use cookies to:</p>
      <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400 space-y-2">
        <li>Keep you logged in</li>
        <li>Remember preferences</li>
        <li>Measure performance and analytics</li>
      </ul>
    </section>

    <section className="mb-8">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Types of cookies</h2>
      <div className="space-y-4">
        <div>
          <h3 className="font-medium text-gray-900 dark:text-white">1. Essential cookies (required)</h3>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            These cookies are necessary for the website to function and cannot be switched off in our systems. They are usually only set in response to actions made by you which amount to a request for services.
          </p>
        </div>
        <div>
          <h3 className="font-medium text-gray-900 dark:text-white">2. Functional cookies</h3>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            These cookies enable the website to provide enhanced functionality and personalization. They may be set by us or by third party providers whose services we have added to our pages.
          </p>
        </div>
        <div>
          <h3 className="font-medium text-gray-900 dark:text-white">3. Analytics cookies</h3>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            These cookies allow us to count visits and traffic sources so we can measure and improve the performance of our site. They help us to know which pages are the most and least popular and see how visitors move around the site.
          </p>
        </div>
      </div>
    </section>

    <section className="mb-8">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Managing cookies</h2>
      <p className="text-gray-600 dark:text-gray-400">
        You may control cookies through your browser settings. Please note that disabling certain cookies may affect the functionality of our website.
      </p>
    </section>

    <section className="mb-8">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Contact</h2>
      <p className="text-gray-600 dark:text-gray-400">
        If you have any questions about our use of cookies, please contact us at{" "}
        <a href="mailto:support@safegoglobal.com" className="text-blue-600 hover:underline">support@safegoglobal.com</a>
      </p>
    </section>
  </>
);

export default function CookiesPage() {
  return (
    <CmsLegalPage
      slug="cookies"
      fallbackTitle="Cookie Policy"
      fallbackContent={<CookiesFallbackContent />}
      seoTitle="Cookie Policy | SafeGo"
      seoDescription="Learn about how SafeGo uses cookies to improve your experience. Understand cookie types and how to manage your preferences."
      seoKeywords="cookie policy, cookies, tracking, SafeGo cookies, privacy"
    />
  );
}
