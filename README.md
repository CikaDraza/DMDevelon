# DMDevelon Portfolio

A full-stack portfolio website built with Next.js 14, MongoDB, and Tailwind CSS. Features admin and client dashboards, authentication, and CMS functionality.

![Portfolio Preview](https://res.cloudinary.com/dufo1t5li/image/upload/v1771869893/profile_picture_nmlgdr.png)

## 🚀 Features

### Landing Page
- **Hero Section** - Animated dual-column layout with profile picture
- **Services Grid** - Colorful service cards with icons
- **Projects Carousel** - Filterable project showcase
- **Testimonials** - Client testimonials with admin replies
- **Contact Form** - Message submission with database storage

### Admin Dashboard (`/admin`)
- 📊 Statistics Overview with Charts (Recharts)
- 🛠️ Services Management (CRUD)
- 📁 Projects Management (CRUD)
- 💬 Testimonials Management with Reply
- 👥 Users Management
- 📧 Contact Messages
- 🏢 Company Profile Settings
- 📄 CMS Pages (Privacy, Terms, etc.)

### Client Dashboard (`/dashboard`)
- View purchased/requested services
- Leave and manage testimonials
- Edit profile and password
- Account deletion option

### Authentication
- JWT-based authentication
- Role-based access (Admin/User)
- Login/Register with validation
- Protected API routes

## 🛠️ Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Database:** MongoDB with Mongoose
- **Styling:** Tailwind CSS, shadcn/ui
- **Animations:** Framer Motion
- **Charts:** Recharts
- **State Management:** TanStack React Query
- **Authentication:** JWT, bcryptjs
- **File Uploads:** Cloudinary
- **Email:** Nodemailer
- **Markdown:** react-markdown, rehype-raw

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/CikaDraza/DMDevelon.git
   cd DMDevelon
   ```

2. **Install dependencies**
   ```bash
   yarn install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your configuration:
   - MongoDB connection string
   - Cloudinary credentials
   - Email SMTP settings
   - JWT secret

4. **Run development server**
   ```bash
   yarn dev
   ```

5. **Seed the database (optional)**
   ```bash
   curl -X POST http://localhost:3000/api/seed
   ```
   This creates:
   - Admin user (email: drazic.milan@gmail.com, password: Admin@123)
   - Sample services, projects, testimonials
   - Default CMS pages

## 🔧 Environment Variables

| Variable | Description |
|----------|-------------|
| `MONGO_URL` | MongoDB connection string |
| `DB_NAME` | Database name |
| `NEXT_PUBLIC_BASE_URL` | Application base URL |
| `CLOUDINARY_NAME` | Cloudinary cloud name |
| `CLOUDINARY_KEY` | Cloudinary API key |
| `CLOUDINARY_SECRET` | Cloudinary API secret |
| `EMAIL_SERVER` | SMTP server host |
| `EMAIL_PORT` | SMTP port |
| `EMAIL_USER` | SMTP username |
| `EMAIL_PASSWORD` | SMTP password |
| `JWT_SECRET` | Secret for JWT signing |

## 📁 Project Structure

```
├── app/
│   ├── api/[[...path]]/    # API routes
│   ├── admin/              # Admin dashboard
│   ├── dashboard/          # Client dashboard
│   ├── projects/[slug]/    # Project detail pages
│   ├── [...slug]/          # CMS pages
│   ├── page.js             # Landing page
│   └── layout.js           # Root layout
├── components/
│   └── ui/                 # shadcn/ui components
├── hooks/                  # Custom React hooks
├── lib/                    # Utilities (auth, db)
├── models/                 # Mongoose models
├── providers/              # React providers
└── public/                 # Static assets
```

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/me` - Get current user

### Resources (CRUD)
- `/api/services` - Services management
- `/api/projects` - Projects management
- `/api/testimonials` - Testimonials
- `/api/users` - Users (admin only)
- `/api/contact-messages` - Contact form messages
- `/api/cms-pages` - CMS pages
- `/api/company-profile` - Company settings

### Utilities
- `GET /api/health` - Health check
- `GET /api/statistics` - Dashboard stats
- `POST /api/seed` - Seed database

## 🎨 Customization

### Colors
Edit `app/globals.css` to change the color scheme:
- Primary: `#FFB633` (golden)
- Dark: `#0f0f10`
- Dark Secondary: `#2C2C2C`

### Services Grid
Services support `gridSpan` (1-7) for flexible layouts.

### CMS Pages
Supports both **Markdown** and **HTML** content.

## 📄 License

MIT License - feel free to use this project for your own portfolio!

## 👨‍💻 Author

**Milan Drazic** - [DMDevelon](https://github.com/CikaDraza)

---

⭐ If you like this project, please give it a star on GitHub!
