import { NextResponse } from "next/server";

type Decade = {
    label: string;
    start: number;
    end: number;
}

function generateDecades (
    startYear = 1880,
    endYear = new Date ().getFullYear ()
): Decade [] {
    const decades: Decade [] = [];

    for (let year = startYear; year <= endYear; year += 10) {
        const decadeStart = year;
        const decadeEnd = year + 9;
        
        decades.push ({
            label: `${decadeStart}s`,
            start: decadeStart,
            end: decadeEnd,
        });
    }

    return decades;
}

export async function GET () {
    try {
        const decades = generateDecades (1880);

        return NextResponse.json ({
            ok: true,
            decades,
        });
    } catch (e) {
        return NextResponse.json (
            { ok: false, error: String (e) },
            { status: 500 }
        )
    }
    
}