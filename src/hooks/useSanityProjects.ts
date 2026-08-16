import { useState, useEffect } from 'react';
import { sanityClient } from '../sanityClient';

export interface SanityProject {
  _id: string;
  title: string;
  category: string;
  playbackId: string | null;
  displaySection: 'portfolio' | 'directorCut' | 'clip' | 'hero' | null;
}

export function useSanityProjects() {
  const [projects, setProjects] = useState<SanityProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    sanityClient
      .fetch<SanityProject[]>(`*[_type == "portfolioProject"] | order(_createdAt desc) {
        _id,
        title,
        category,
        displaySection,
        "playbackId": video.asset->playbackId
      }`)
      .then((data) => {
        setProjects(data);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error fetching projects from Sanity:", error);
        setLoading(false);
      });
  }, []);

  return { projects, loading };
}
