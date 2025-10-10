import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import {
  Upload,
  MessageCircle,
  TrendingUp,
  Sparkles,
  Check,
  ArrowRight,
} from 'lucide-react'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState([
    {
      type: 'user',
      text: 'How much did I spend on groceries last month?',
    },
    {
      type: 'ai',
      text: 'You spent $487.50 on groceries in December 2024. This includes 15 transactions from stores like Whole Foods ($215), Trader Joes ($145), and Walmart ($127.50).',
    },
  ])

  const features = [
    {
      icon: <Upload className="w-12 h-12 text-primary" />,
      title: 'Upload Statements',
      description:
        'Simply upload your credit card statements (PDF or CSV). Our AI automatically categorizes every transaction.',
    },
    {
      icon: <MessageCircle className="w-12 h-12 text-primary" />,
      title: 'Ask Questions',
      description:
        'Chat with your financial data in plain English. Get instant answers about your spending patterns.',
    },
    {
      icon: <TrendingUp className="w-12 h-12 text-primary" />,
      title: 'Gain Insights',
      description:
        'Discover trends, track categories, and understand where your money goes with beautiful visualizations.',
    },
  ]

  const howItWorks = [
    {
      step: '1',
      title: 'Upload Your Statement',
      description:
        'Drag and drop your credit card statement. We support PDF and CSV from any bank.',
    },
    {
      step: '2',
      title: 'AI Categorizes Everything',
      description:
        'Our AI reads every transaction and automatically categorizes them - groceries, dining, travel, and more.',
    },
    {
      step: '3',
      title: 'Ask Anything',
      description:
        'Type questions like "How much did I spend on dining?" or "Show my Amazon purchases" - get instant answers.',
    },
  ]

  const pricingPlans = [
    {
      name: 'Free',
      price: '$0',
      period: 'forever',
      description: 'Perfect to get started',
      features: [
        '1 statement per month',
        '50 AI queries',
        'Basic analytics',
        'Email support',
      ],
      cta: 'Start Free',
      highlighted: false,
    },
    {
      name: 'Pro',
      price: '$9',
      period: 'per month',
      description: 'For serious money managers',
      features: [
        'Unlimited statements',
        'Unlimited AI queries',
        'Advanced analytics & charts',
        'Export reports (PDF/CSV)',
        'Priority support',
        'Custom categories',
      ],
      cta: 'Start Free Trial',
      highlighted: true,
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Navbar */}
      <nav className="border-b border-slate-700 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-8 h-8 text-primary" />
            <span className="text-2xl font-bold text-white">hilm.ai</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              to="/sign-in"
              className="text-gray-300 hover:text-white transition-colors"
            >
              Sign In
            </Link>
            <Link
              to="/sign-in"
              className="btn btn-primary"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative py-20 px-6 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-secondary/10 to-accent/10"></div>
        <div className="relative max-w-6xl mx-auto">
          <div className="mb-6">
            <span className="inline-block px-4 py-1 bg-primary/20 text-primary rounded-full text-sm font-medium mb-6">
              AI-Powered Financial Insights
            </span>
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
              Your Financial Dreams,{' '}
              <span className="text-primary">
                Clarified
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto mb-8">
              Upload credit card statements, ask questions in plain English, and
              get instant AI-powered insights about your spending.
            </p>
          </div>

          {/* Interactive Chat Demo */}
          <div className="max-w-2xl mx-auto mb-12">
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6 shadow-2xl">
              <div className="space-y-4 mb-4">
                {chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] px-4 py-3 rounded-lg ${
                        msg.type === 'user'
                          ? 'bg-primary text-primary-content'
                          : 'bg-slate-700 text-gray-200'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Try: How much did I spend on Amazon?"
                  className="input input-bordered flex-1"
                />
                <button className="btn btn-primary">
                  Ask
                </button>
              </div>
            </div>
          </div>

          <Link
            to="/sign-in"
            className="btn btn-primary btn-lg"
          >
            Start Free Today
            <ArrowRight className="w-5 h-5" />
          </Link>
          <p className="text-gray-400 text-sm mt-4">
            No credit card required • Free forever plan available
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6 bg-slate-900/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              How It Works
            </h2>
            <p className="text-xl text-gray-400">
              Get financial clarity in three simple steps
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="card bg-base-200 border border-base-300 hover:border-primary/50 transition-all duration-300"
              >
                <div className="mb-6">{feature.icon}</div>
                <h3 className="text-2xl font-semibold text-white mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-400 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Detailed */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="space-y-12">
            {howItWorks.map((item, index) => (
              <div
                key={index}
                className="flex flex-col md:flex-row items-start gap-6"
              >
                <div className="flex-shrink-0 w-16 h-16 bg-primary rounded-full flex items-center justify-center text-primary-content text-2xl font-bold">
                  {item.step}
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-white mb-2">
                    {item.title}
                  </h3>
                  <p className="text-gray-400 text-lg">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 px-6 bg-slate-900/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-gray-400">
              Start free, upgrade when you need more
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {pricingPlans.map((plan, index) => (
              <div
                key={index}
                className={`card bg-base-200 border p-8 ${
                  plan.highlighted
                    ? 'border-primary ring-2 ring-primary/50 scale-105'
                    : 'border-base-300'
                }`}
              >
                {plan.highlighted && (
                  <span className="badge badge-primary mb-4">
                    Most Popular
                  </span>
                )}
                <h3 className="text-2xl font-bold text-white mb-2">
                  {plan.name}
                </h3>
                <div className="mb-4">
                  <span className="text-5xl font-bold text-white">
                    {plan.price}
                  </span>
                  <span className="text-gray-400 ml-2">{plan.period}</span>
                </div>
                <p className="text-gray-400 mb-6">{plan.description}</p>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                      <span className="text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  to="/sign-in"
                  className={`btn w-full ${
                    plan.highlighted
                      ? 'btn-primary'
                      : 'btn-neutral'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to Understand Your Spending?
          </h2>
          <p className="text-xl text-gray-400 mb-8">
            Join thousands who have gained clarity on their finances with AI
          </p>
          <Link
            to="/sign-in"
            className="btn btn-primary btn-lg"
          >
            Get Started Free
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-700 py-12 px-6 bg-slate-900/50">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-6 h-6 text-primary" />
                <span className="text-xl font-bold text-white">hilm.ai</span>
              </div>
              <p className="text-gray-400 text-sm">
                Your financial dreams, clarified with AI
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3">Product</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Pricing
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    FAQ
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3">Company</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    About
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Blog
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Contact
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3">Legal</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li>
                  <Link
                    to="/privacy"
                    className="hover:text-white transition-colors"
                  >
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link
                    to="/terms"
                    className="hover:text-white transition-colors"
                  >
                    Terms
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-700 pt-8 text-center text-gray-400 text-sm">
            © 2025 hilm.ai. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
