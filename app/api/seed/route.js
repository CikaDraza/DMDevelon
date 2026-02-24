import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import Service from '@/models/Service';
import Project from '@/models/Project';
import Testimonial from '@/models/Testimonial';
import CMSPage from '@/models/CMSPage';
import { hashPassword } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request) {
  await connectDB();

  try {
    // Check if admin user already exists
    let adminUser = await User.findOne({ email: 'drazic.milan@gmail.com' });
    
    if (adminUser) {
      // Update the password to a known value
      adminUser.password = hashPassword('Admin@123');
      await adminUser.save();
    } else {
      // Create admin user
      adminUser = await User.create({
        _id: uuidv4(),
        name: 'Milan Drazic',
        email: 'drazic.milan@gmail.com',
        password: hashPassword('Admin@123'),
        isAdmin: true,
        image: 'https://res.cloudinary.com/dufo1t5li/image/upload/v1771869893/profile_picture_nmlgdr.png',
      });
    }

    // Create default services if none exist
    const servicesCount = await Service.countDocuments();
    if (servicesCount === 0) {
      const defaultServices = [
        { title: 'Web Development', description: 'Modern, responsive web applications built with cutting-edge technologies like React, Next.js, and Node.js', icon: 'Code', color: 'blue', category: 'Development', displayOrder: 1, gridSpan: 2 },
        { title: 'UI/UX Design', description: 'Beautiful, intuitive user interfaces that delight users and enhance engagement', icon: 'Palette', color: 'purple', category: 'Design', displayOrder: 2, gridSpan: 2 },
        { title: 'Mobile Apps', description: 'Cross-platform mobile applications for iOS and Android using React Native', icon: 'Smartphone', color: 'green', category: 'Mobile', displayOrder: 3, gridSpan: 1 },
        { title: 'E-commerce', description: 'Online stores with secure payments, inventory management, and analytics', icon: 'Globe', color: 'orange', category: 'E-commerce', displayOrder: 4, gridSpan: 2 },
        { title: 'Digital Marketing', description: 'SEO, social media marketing, and growth strategies for your business', icon: 'TrendingUp', color: 'pink', category: 'Marketing', displayOrder: 5, gridSpan: 2 },
        { title: 'Cloud Services', description: 'Scalable cloud infrastructure, DevOps, and serverless architecture', icon: 'Cloud', color: 'cyan', category: 'Cloud', displayOrder: 6, gridSpan: 2 },
      ];

      for (const service of defaultServices) {
        await Service.create({ _id: uuidv4(), ...service });
      }
    }

    // Create default projects if none exist
    const projectsCount = await Project.countDocuments();
    if (projectsCount === 0) {
      const defaultProjects = [
        {
          title: 'Electricons',
          description: 'A great selection of appliances for your home - white goods, small household appliances, televisions, computers, telephones, care appliances, everything you need in one place.',
          image_url: 'https://res.cloudinary.com/dufo1t5li/image/upload/v1771878769/electricons_qaposn.png',
          logo_url: 'https://www.electricons.shop/logo/electricons_logo.svg',
          live_preview_url: 'https://www.electricons.shop/',
          github_url: 'https://github.com/CikaDraza/electricons',
          color: 'blue',
          category: 'E-commerce',
          slug: 'electricons',
        },
        {
          title: 'Portfolio Website',
          description: 'A modern portfolio website built with Next.js, featuring smooth animations, dark theme, and responsive design. Showcases projects, services, and testimonials.',
          image_url: '',
          live_preview_url: '',
          github_url: '',
          color: 'purple',
          category: 'Web App',
          slug: 'portfolio-website',
        },
        {
          title: 'Task Manager App',
          description: 'A productivity app for managing tasks, projects, and team collaboration. Features include Kanban boards, time tracking, and integrations.',
          image_url: '',
          live_preview_url: '',
          github_url: '',
          color: 'green',
          category: 'Web App',
          slug: 'task-manager-app',
        },
      ];

      for (const project of defaultProjects) {
        await Project.create({ _id: uuidv4(), ...project });
      }
    }

    // Create default testimonials if none exist
    const testimonialsCount = await Testimonial.countDocuments();
    if (testimonialsCount === 0) {
      const defaultTestimonials = [
        {
          clientName: 'Zoran Stevovic',
          clientEmail: 'zsinfo@infogram.rs',
          clientTitle: 'Infogram CTO',
          rating: 4,
          comment: 'Kroz otvorenu komunikaciju, međusobno učenje i neprestano usavršavanje, mi gradimo snažnu radnu kulturu koja podstiče inovacije, kreativnost i lični razvoj.',
          adminReply: 'Thanks for your kind words!',
        },
        {
          clientName: 'Sarah Johnson',
          clientEmail: 'sarah@example.com',
          clientTitle: 'Marketing Director',
          rating: 5,
          comment: 'Exceptional work! The project was delivered on time and exceeded our expectations. The attention to detail and creative solutions were outstanding.',
          adminReply: '',
        },
        {
          clientName: 'Michael Brown',
          clientEmail: 'michael@example.com',
          clientTitle: 'Startup Founder',
          rating: 5,
          comment: 'Milan is a true professional. His attention to detail and creative solutions helped us launch our product successfully. Highly recommended!',
          adminReply: 'Thank you Michael! It was a pleasure working with your team.',
        },
      ];

      for (const testimonial of defaultTestimonials) {
        await Testimonial.create({ _id: uuidv4(), ...testimonial });
      }
    }

    // Create default CMS pages if none exist
    const cmsCount = await CMSPage.countDocuments();
    if (cmsCount === 0) {
      const defaultPages = [
        {
          title: 'Privacy Policy',
          slug: 'privacy',
          content: `# Privacy Policy

Last updated: February 2026

## Introduction

DMDevelon ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website.

## Information We Collect

We may collect information about you in a variety of ways:

### Personal Data
- Name and email address
- Contact information
- Professional information

### Usage Data
- Browser type and version
- Pages visited
- Time spent on pages
- Other diagnostic data

## How We Use Your Information

We use the information we collect to:
- Provide, operate, and maintain our website
- Improve, personalize, and expand our services
- Communicate with you
- Send you newsletters and marketing materials (with your consent)

## Contact Us

If you have questions about this Privacy Policy, please contact us at drazic.milan@gmail.com`,
        },
        {
          title: 'Terms of Service',
          slug: 'terms',
          content: `# Terms of Service

Last updated: February 2026

## Agreement to Terms

By accessing our website, you agree to be bound by these Terms of Service and all applicable laws and regulations.

## Use License

Permission is granted to temporarily view the materials on DMDevelon's website for personal, non-commercial transitory viewing only.

## Disclaimer

The materials on DMDevelon's website are provided on an 'as is' basis. DMDevelon makes no warranties, expressed or implied.

## Limitations

In no event shall DMDevelon be liable for any damages arising out of the use or inability to use the materials on our website.

## Contact

Questions about the Terms of Service should be sent to us at drazic.milan@gmail.com`,
        },
        {
          title: 'Cookie Policy',
          slug: 'cookies',
          content: `# Cookie Policy

Last updated: February 2026

## What Are Cookies

Cookies are small text files that are stored on your computer or mobile device when you visit our website.

## How We Use Cookies

We use cookies to:
- Keep you signed in
- Remember your preferences
- Analyze site traffic
- Improve user experience

## Types of Cookies We Use

### Essential Cookies
Required for the website to function properly.

### Analytics Cookies
Help us understand how visitors interact with our website.

### Marketing Cookies
Used to track visitors across websites for advertising purposes.

## Managing Cookies

You can control and manage cookies through your browser settings.

## Contact Us

If you have questions about our Cookie Policy, contact us at drazic.milan@gmail.com`,
        },
      ];

      for (const page of defaultPages) {
        await CMSPage.create({ _id: uuidv4(), ...page });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Database seeded successfully!',
      admin: {
        email: 'drazic.milan@gmail.com',
        password: 'Admin@123',
      },
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
