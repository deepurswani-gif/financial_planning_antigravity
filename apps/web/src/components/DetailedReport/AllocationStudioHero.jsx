import React from 'react';
import { Sparkles } from 'lucide-react';
import ThreeMonthSurplusGrid from './ThreeMonthSurplusGrid';

const AllocationStudioHero = ({ hero }) => (
    <div className="pymtw-zone-a card">
        <div className="pymtw-zone-a-top">
            <div className="pymtw-ai-badge">
                <Sparkles size={14} />
                Finbrella Allocation Studio
            </div>
        </div>

        <ThreeMonthSurplusGrid
            outlook={hero.threeMonthOutlook}
            variant="hero"
            animate
        />
    </div>
);

export default AllocationStudioHero;
