import React from 'react'
import Hero from '../components/Hero.jsx'
import Features from '../components/Features.jsx'
import Security from '../components/Security.jsx'
import FeaturesCarousel from '../components/FeaturesCarousel.jsx'
import HomePriceComponent from '../components/HomePriceComponent.jsx'
import ChatDemoBox from '../components/ChatDemoBox.jsx'


const Home = () => {
  return (
    <>
    <Hero/>
    <Features/>
    <Security/>
    <FeaturesCarousel/>
    <HomePriceComponent/>
    <ChatDemoBox/>
    </>
  )
}

export default Home
