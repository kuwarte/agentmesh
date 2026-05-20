import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const email = body.email?.trim().toLowerCase()

    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json(
        {
          error: 'Invalid email address',
        },
        {
          status: 400,
        }
      )
    }

    const supabase = createServerClient()

    const { error } = await supabase
      .from('waitlist')
      .insert({
        email,
      })

    if (error?.code === '23505') {
      return NextResponse.json(
        {
          error: 'Email already exists in waitlist',
        },
        {
          status: 409,
        }
      )
    }

    if (error) {
      console.error(error)

      return NextResponse.json(
        {
          error: 'Failed to join waitlist',
        },
        {
          status: 500,
        }
      )
    }

    const { count } = await supabase
      .from('waitlist')
      .select('*', {
        count: 'exact',
        head: true,
      })

    return NextResponse.json({
      success: true,
      count: count ?? 0,
    })
  } catch (err) {
    console.error(err)

    return NextResponse.json(
      {
        error: 'Server error',
      },
      {
        status: 500,
      }
    )
  }
}

export async function GET() {
  try {
    const supabase = createServerClient()

    const { count } = await supabase
      .from('waitlist')
      .select('*', {
        count: 'exact',
        head: true,
      })

    return NextResponse.json({
      count: count ?? 0,
    })
  } catch {
    return NextResponse.json({
      count: 0,
    })
  }
}