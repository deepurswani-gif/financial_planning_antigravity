import {
    Target, GraduationCap, Home, Car, Plane, Heart, Award,
} from 'lucide-react';

/** Shared goal icon resolver for Dreams & Goals and Life Journey report. */
export const getGoalIcon = (goal) => {
    const name = (goal?.name || '').toLowerCase();
    const id = goal?.id || '';
    if (name.includes('educat') || id.startsWith('edu_')) return GraduationCap;
    if (name.includes('retire') || id === 'retirement') return Award;
    if (name.includes('bike')) return Car;
    if (name.includes('car') || id === 'car') return Car;
    if (name.includes('tour') || name.includes('vacat') || id.includes('tour')) return Plane;
    if (name.includes('house') || name.includes('flat') || name.includes('construct') || name.includes('renovat')) return Home;
    if (name.includes('marriage') || id.startsWith('marriage_')) return Heart;
    return Target;
};
