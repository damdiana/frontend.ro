import React from 'react';
import Link from '~/components/generic/Link';
import { Trans } from '~/services/typesafeNextTranslate';
import { ResourceDescription, RESOURCES } from '~/components/learn/Resources/resources-model';

import styles from './LandingResources.module.scss';

const LandingResources = ({ className = '' }: { className?: string }) => {
  const allResources: ResourceDescription[] = Object.keys(RESOURCES).flatMap((key) => {
    return RESOURCES[key].map((r) => ({
      ...r,
      // Overwrite link so it points to the Resources page
      url: `/resurse#${key}`,
    }));
  });

  return (
    <div className={className}>
      <div className={styles.CallToAction}>
        <h2 className="mb-8 d-inline-block">
          <Trans i18nKey='common:LandingResources.title' components={[
            <Link key='0' prefetch={false} color="blue" href="/resurse"/>,
          ]} />
        </h2>
      </div>
      <div className={styles.Grid}>
        {allResources.map((resource) => (
          <Link
            prefetch={false}
            key={resource.title}
            href={resource.url}
            title={resource.title}
            className={`${styles.Item} cursor-pointer d-block`}
          >
            <img
              loading="lazy"
              src={resource.cover}
              alt={resource.title}
              className="relative w-100 h-100 d-block"
            />
          </Link>
        ))}
      </div>
      <Link prefetch={false} variant="contained" color="black" className={`${styles.Link} w-100 mt-4 text-center`} href="/resurse">
        Vezi resursele
      </Link>
    </div>
  );
};

export default LandingResources;
